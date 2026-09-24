/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Channel-based State Management Engine
 * Isolated clean-room architectural engine
 * Extracted by Engine Harvester
 */

/**
 * Interface for writing (updating) a channel.
 */
interface ChannelWriter {
    update(value: any): void;
}

/**
 * Interface for reading (getting) a channel's value.
 */
interface ChannelReader {
    get(): any;
}

/**
 * Abstract base class for all channel types, providing common functionality.
 */
abstract class BaseChannel implements ChannelWriter, ChannelReader {
    protected _value: any;

    /**
     * @param initialValue The starting value for the channel.
     */
    constructor(initialValue: any) {
        this._value = initialValue;
    }

    /**
     * Abstract method to be implemented by concrete channel types for their specific update logic.
     * @param newValue The value to apply to the channel.
     */
    abstract update(newValue: any): void;

    /**
     * Retrieves the current value of the channel.
     * @returns The current value of the channel.
     */
    get(): any {
        return this._value;
    }
}

/**
 * A channel where the latest update completely overwrites the previous value.
 */
class LastWriteWinsChannel extends BaseChannel {
    constructor(initialValue: any = null) {
        super(initialValue);
    }
    update(newValue: any): void {
        this._value = newValue;
    }
}

/**
 * A channel that aggregates values using a custom binary operator function.
 * E.g., for summing numbers, concatenating strings, merging objects.
 */
class BinaryOperatorChannel extends BaseChannel {
    private operator: (current: any, new_val: any) => any;

    /**
     * @param initialValue The starting value.
     * @param operator The function to combine current and new values.
     */
    constructor(initialValue: any, operator: (current: any, new_val: any) => any) {
        super(initialValue);
        this.operator = operator;
    }
    update(newValue: any): void {
        this._value = this.operator(this._value, newValue);
    }
}

/**
 * A channel that appends new values to an internal list.
 * If the new value is an array, its elements are spread into the list.
 */
class AppendListChannel extends BaseChannel {
    constructor(initialValue: any[] = []) {
        // Ensure initial value is an array
        super(Array.isArray(initialValue) ? initialValue : [initialValue]);
    }
    update(newValue: any): void {
        if (!Array.isArray(this._value)) {
            this._value = []; // Ensure it's a list if it wasn't initially
        }
        if (Array.isArray(newValue)) {
            this._value.push(...newValue);
        } else {
            this._value.push(newValue);
        }
    }
}

/**
 * The Channel-based State Management Engine.
 * Manages the global state of the graph by overseeing individual channels and their aggregation.
 */
class ChannelStateManager {
    private channels: Map<string, BaseChannel> = new Map();
    private channelConfigs: Record<string, ChannelConfig>;

    /**
     * Initializes the state manager with channel configurations and an optional initial state.
     * @param channelConfigs A map of channel names to their configurations.
     * @param initialState An optional initial state object to populate channels.
     */
    constructor(channelConfigs: Record<string, ChannelConfig>, initialState: State = {}) {
        this.channelConfigs = channelConfigs;

        // Initialize channels based on provided configurations
        for (const key in channelConfigs) {
            const config = channelConfigs[key];
            let channel: BaseChannel;
            switch (config.aggregator) {
                case 'last_write_wins':
                    channel = new LastWriteWinsChannel(initialState[key] ?? config.default_value ?? null);
                    break;
                case 'binary_operator':
                    if (!config.operator) throw new Error(`Operator function is required for 'binary_operator' channel config for '${key}'.`);
                    channel = new BinaryOperatorChannel(initialState[key] ?? config.default_value ?? null, config.operator);
                    break;
                case 'append_list':
                    channel = new AppendListChannel(initialState[key] ?? config.default_value ?? []);
                    break;
                default:
                    throw new Error(`Unknown aggregator type: ${config.aggregator} for channel '${key}'.`);
            }
            this.channels.set(key, channel);
        }

        // Apply any initial state values that were not explicitly configured in channels
        // This implicitly creates 'last_write_wins' channels for unconfigured state keys.
        for (const key in initialState) {
            if (!this.channels.has(key)) {
                console.warn(`Initial state key '${key}' not defined in channel configurations. Creating a default LastWriteWinsChannel.`);
                this.channels.set(key, new LastWriteWinsChannel(initialState[key]));
            }
        }
    }

    /**
     * Retrieves a reader for a specific channel. If the channel doesn't exist, a default
     * LastWriteWinsChannel is created and returned.
     * @param key The name of the channel.
     * @returns A ChannelReader instance for the specified channel.
     */
    getChannelReader(key: string): ChannelReader {
        let channel = this.channels.get(key);
        if (!channel) {
            console.warn(`Channel '${key}' not explicitly configured. Creating a default LastWriteWinsChannel.`);
            channel = new LastWriteWinsChannel();
            this.channels.set(key, channel);
        }
        return channel;
    }

    /**
     * Retrieves a writer for a specific channel. If the channel doesn't exist, a default
     * LastWriteWinsChannel is created and returned.
     * @param key The name of the channel.
     * @returns A ChannelWriter instance for the specified channel.
     */
    getChannelWriter(key: string): ChannelWriter {
         let channel = this.channels.get(key);
        if (!channel) {
            console.warn(`Channel '${key}' not explicitly configured. Creating a default LastWriteWinsChannel.`);
            channel = new LastWriteWinsChannel();
            this.channels.set(key, channel);
        }
        return channel;
    }

    /**
     * Gets a snapshot of the current, aggregated global state across all channels.
     * @returns The current global state as a `State` object.
     */
    getCurrentState(): State {
        const state: State = {};
        for (const [key, channel] of this.channels.entries()) {
            state[key] = channel.get();
        }
        return state;
    }

    /**
     * Applies a set of updates to the appropriate channels.
     * For each key-value pair in `updates`, the corresponding channel's update logic is invoked.
     * @param updates A partial state object containing updates for various channels.
     */
    applyUpdates(updates: State): void {
        for (const key in updates) {
            const channel = this.getChannelWriter(key); // Ensure channel exists, creating if necessary
            channel.update(updates[key]);
        }
    }
}
