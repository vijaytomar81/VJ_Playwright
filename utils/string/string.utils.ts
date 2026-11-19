
/**
 * Generic string transformation and matching utilities.
 *
 * Framework-agnostic and reusable across all layers.
 */
export class StringUtils {
    /**
     * Splits a string into words.
     *
     * Example:
     * "carDetailsPage" -> ["car", "Details", "Page"]
     */
    static toWords(value: string): string[] {
        return value
            .trim()
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/[^a-zA-Z0-9]+/g, ' ')
            .split(/\s+/)
            .filter(Boolean);
    }

    /**
     * Converts a string to camelCase.
     *
     * Example:
     * "car-details-page" -> "carDetailsPage"
     */
    static toCamelCase(value: string): string {
        const words = this.toWords(value);

        if (words.length === 0) {
            return '';
        }

        const [first, ...rest] = words;

        return (
            first.toLowerCase() +
            rest.map(word => this.capitalize(word)).join('')
        );
    }

    /**
     * Converts a string to PascalCase.
     *
     * Example:
     * "car-details-page" -> "CarDetailsPage"
     */
    static toPascalCase(value: string): string {
        return this.toWords(value)
            .map(word => this.capitalize(word))
            .join('');
    }

    /**
     * Converts a string to kebab-case.
     *
     * Example:
     * "CarDetailsPage" -> "car-details-page"
     */
    static toKebabCase(value: string): string {
        return this.toWords(value)
            .map(word => word.toLowerCase())
            .join('-');
    }

    /**
     * Capitalizes the first character and lowercases the rest.
     *
     * Example:
     * "mOTOR" -> "Motor"
     */
    static capitalize(value: string): string {
        if (!value) {
            return '';
        }

        return (
            value.charAt(0).toUpperCase() +
            value.slice(1).toLowerCase()
        );
    }

    /**
     * Finds a case-insensitive match in a list of strings.
     *
     * Returns the original configured value, preserving its case.
     *
     * Examples:
     * matchIgnoreCase("azo", ["AZO", "BRI"]) -> "AZO"
     * matchIgnoreCase("MOTOR", ["Home", "Motor"]) -> "Motor"
     * matchIgnoreCase("unknown", ["Home"]) -> undefined
     */
    static matchIgnoreCase<T extends string>(
        input: string,
        allowed: readonly T[],
    ): T | undefined {
        const normalized = input.trim().toLowerCase();

        return allowed.find(
            value => value.toLowerCase() === normalized,
        );
    }
}
