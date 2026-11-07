// Vercel Serverless Function: Tải file JSON trực tiếp từ Google Drive cho bản Web
export default async function handler(req: any, res: any) {
  // Bật CORS cho phép Web client tải trực tiếp
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { fileId, url } = req.query;
  let targetId = fileId;

  // Tự động trích xuất file ID từ link Google Drive người dùng dán vào
  if (!targetId && url) {
    const rawUrl = decodeURIComponent(url);
    const match = rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || rawUrl.match(/id=([a-zA-Z0-9_-]+)/);
    if (match) targetId = match[1];
  }

  if (!targetId) {
    return res.status(400).json({ error: 'Vui lòng cung cấp link hoặc ID file Google Drive.' });
  }

  try {
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${targetId}`;
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Không thể tải file từ Google Drive (Mã lỗi: ${response.status}). Hãy đảm bảo file được chia sẻ ở chế độ "Bất kỳ ai có đường liên kết".`,
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Lỗi xử lý file từ Google Drive' });
  }
}
