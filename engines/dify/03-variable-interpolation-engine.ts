/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Variable Interpolation Engine
 * Isolated clean-room architectural engine
 * Extracted by Engine Harvester
 */

class VariableInterpolationEngine {
  private readonly regex = /\{\{([\w\.]+)\}\}/g;

  public interpolate(template: string, context: Record<string, any>): string {
    return template.replace(this.regex, (match, key) => {
      const value = this.resolveValue(key, context);
      return value !== undefined ? String(value) : match;
    });
  }

  private resolveValue(path: string, context: Record<string, any>): any {
    return path.split('.').reduce((acc, part) => acc && acc[part], context);
  }
}

// Example Usage:
// const engine = new VariableInterpolationEngine();
// const result = engine.interpolate("Hello {{user.name}}", { user: { name: "Architect" } });
