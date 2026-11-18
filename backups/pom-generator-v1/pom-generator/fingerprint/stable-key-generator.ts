import {
    randomUUID,
} from 'node:crypto';

export class StableKeyGenerator {

    generate(): string {
        return randomUUID();
    }
}