/** The file name an image is stored under on the phone: its database id plus the original extension. */
export function imageFileName(imageId: number, url: string): string {
    const path = url.split(/[?#]/)[0];
    const match = /\.([A-Za-z0-9]{2,5})$/.exec(path);
    const extension = match ? match[1].toLowerCase() : "jpg";
    return `${imageId}.${extension}`;
}
