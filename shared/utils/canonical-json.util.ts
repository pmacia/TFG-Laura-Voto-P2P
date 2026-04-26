export function canonicalJson(data: any): string {
    return JSON.stringify(sortObject(data));
}

function sortObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(sortObject);
    }

    const sorted: any = {};
    Object.keys(obj).sort().forEach((key) => {
        sorted[key] = sortObject(obj[key]);
    });

    return sorted;
}