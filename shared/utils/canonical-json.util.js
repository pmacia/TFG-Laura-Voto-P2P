export function canonicalJson(data) {
    return JSON.stringify(sortObject(data));
}

function sortObject(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(sortObject);
    }

    const sorted = {};
    Object.keys(obj).sort().forEach((key) => {
        sorted[key] = sortObject(obj[key]);
    });

    return sorted;
}