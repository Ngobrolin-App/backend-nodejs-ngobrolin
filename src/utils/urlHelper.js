
function buildAvatarUrl(path, baseUrl) {
    if (!path) return null;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${normalizedPath}`;
}

module.exports = {
    buildAvatarUrl
};
