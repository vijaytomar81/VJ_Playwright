
import { scanDom } from '../scanner/dom-scanner';

export function scan(pageName: string, url: string) {
    return scanDom(document, {
        pageName,
        url,
        includeHidden: false,
    });
}
