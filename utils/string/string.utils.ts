/**
 * Generic string transformation utilities.
 *
 * This utility is framework-agnostic and can be reused
 * by any framework layer.
 */
export class StringUtils {

    static toWords(
        value: string,
    ): string[] {
        return value
            .trim()
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/[^a-zA-Z0-9]+/g, ' ')
            .split(/\s+/)
            .filter(Boolean);
    }

    static toCamelCase(
        value: string,
    ): string {
        const words = this.toWords(value);

        if (words.length === 0) {
            return '';
        }

        const [first, ...rest] = words;

        return (
            first.toLowerCase() +
            rest
                .map(word => this.capitalize(word))
                .join('')
        );
    }

    static toPascalCase(
        value: string,
    ): string {
        return this.toWords(value)
            .map(word => this.capitalize(word))
            .join('');
    }

    static toKebabCase(
        value: string,
    ): string {
        return this.toWords(value)
            .map(word => word.toLowerCase())
            .join('-');
    }

    static capitalize(
        value: string,
    ): string {
        if (!value) {
            return '';
        }

        return (
            value.charAt(0).toUpperCase() +
            value.slice(1).toLowerCase()
        );
    }
}