/** Reduce photo uploads while preserving small images, diagrams and animation. */
export async function optimizeQuizImage(file: File): Promise<Blob> {
    if (file.size < 256 * 1024) return file;
    const header = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
    const chunks = new TextDecoder('latin1').decode(header);
    if (chunks.includes('acTL') || chunks.includes('ANIM')) return file;
    const url = URL.createObjectURL(file), image = new Image();
    try {
        image.src = url; await image.decode();
        const width = image.naturalWidth, height = image.naturalHeight;
        if (!width || !height || Math.max(width / height, height / width) > 5) return file;
        const sample = document.createElement('canvas');sample.width = 128;sample.height = 128;
        const sampleContext = sample.getContext('2d', {willReadFrequently: true});
        if (!sampleContext) return file;
        sampleContext.drawImage(image, 0, 0, 128, 128);
        const original = sampleContext.getImageData(0, 0, 128, 128).data;
        const colors = new Set<number>();
        for (let i = 0; i < original.length; i += 16) colors.add((original[i] >> 4) * 256 + (original[i + 1] >> 4) * 16 + (original[i + 2] >> 4));
        // Low-colour artwork often contains small text or precise map details.
        if (colors.size < 240) return file;
        const canvas = document.createElement('canvas'), scale = Math.min(1, 2560 / Math.max(width, height));
        canvas.width = Math.max(1, Math.round(width * scale));canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext('2d');if (!context) return file;
        context.imageSmoothingQuality = 'high';context.drawImage(image, 0, 0, canvas.width, canvas.height);
        for (const quality of [.9, .96]) {
            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality));
            if (!blob || blob.type !== 'image/webp' || blob.size >= file.size * .9) continue;
            const candidate = URL.createObjectURL(blob), decoded = new Image();
            try {
                decoded.src = candidate;await decoded.decode();sampleContext.clearRect(0, 0, 128, 128);sampleContext.drawImage(decoded, 0, 0, 128, 128);
                const pixels = sampleContext.getImageData(0, 0, 128, 128).data;
                // Reject visible colour/alpha changes instead of chasing a byte target.
                let squareError = 0, alphaError = 0;
                for (let i = 0; i < original.length; i += 4) {
                    for (let channel = 0; channel < 3; channel++) squareError += (original[i + channel] - pixels[i + channel]) ** 2;
                    alphaError = Math.max(alphaError, Math.abs(original[i + 3] - pixels[i + 3]));
                }
                if (squareError / (128 * 128 * 3) <= 9 && alphaError <= 1) return blob;
            } finally {URL.revokeObjectURL(candidate);}
        }
        return file;
    } catch {
        // A failed optimization must not turn a previously valid upload into a failure.
        return file;
    } finally {URL.revokeObjectURL(url);}
}
