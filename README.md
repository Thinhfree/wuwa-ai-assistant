# WuWa AI Assistant v1.0 — iPad / iPhone

Ứng dụng PWA miễn phí để đọc chữ từ ảnh chụp màn hình nhiệm vụ **Wuthering Waves** và gợi ý bước tiếp theo. Đây là **MVP hoạt động được**, không phải ứng dụng auto chơi game. Không liên kết với Kuro Games.

## Chức năng sẵn dùng

- Chọn ảnh PNG/JPG từ thư viện iPhone/iPad (không truy cập trực tiếp màn hình game).
- Khoanh vùng chữ để cải thiện OCR; OCR tiếng Anh hoặc tiếng Việt **trên thiết bị** qua Tesseract.js v6.
- Sửa nội dung OCR, phân loại kiểu nhiệm vụ, xem checklist gợi ý chung.
- Lưu/đánh dấu/tiếp tục nhiệm vụ trên thiết bị; xuất/nhập backup JSON.
- Mở Google hoặc YouTube tìm video/walkthrough theo tên nhiệm vụ.
- AI Vision **tùy chọn** qua Cloudflare Worker riêng, dùng Gemini API; có thể phân tích thêm ảnh câu đố.

**Giới hạn cần biết:** Chế độ miễn phí không có database lời giải từng quest, nên checklist chỉ là gợi ý dựa trên từ khóa, không phải lời giải chính xác. Bản AI có thể suy đoán sai. Ứng dụng không tự bấm hoặc điều khiển Wuthering Waves.

## Cách dễ nhất để dùng trên iPhone/iPad — GitHub Pages miễn phí

1. Giải nén bộ mã nguồn và tạo một repository **Public** mới trên https://github.com/new (ví dụ `wuwa-ai-assistant`).
2. Upload **nội dung bên trong thư mục** `WuWa_AI_Assistant_v1` lên nhánh `main` của repository. `index.html` phải nằm ở **gốc repo**, không nằm trong thư mục con. GitHub Pages **không được dùng làm kho chứa API key**, không upload `.env`, `.dev.vars` hay Secrets.
3. Vào repo → **Settings → Pages → Build and deployment → Deploy from a branch** → chọn `main` và `/ (root)` → Save.
4. Sau khi GitHub Pages triển khai xong, mở URL kiểu `https://TEN_GITHUB.github.io/wuwa-ai-assistant/` trên Safari iPhone/iPad.
5. Nhấn biểu tượng **Chia sẻ → Thêm vào Màn hình chính (Add to Home Screen)**.
6. Mở app từ màn hình chính. Chụp ảnh nhiệm vụ trong game → chọn ảnh → OCR → chỉnh mục tiêu → Phân tích → Lưu Journal.

Không cần cài Xcode hoặc jailbreak. Không cần Gemini key để dùng các tính năng cơ bản.

### Thử ngay trên Mac trước khi đưa lên GitHub

Mở Terminal tại thư mục đã giải nén:

```bash
python3 -m http.server 8080
```

Truy cập http://localhost:8080/ trên chính Mac. Một số máy Mac chưa có `python3`; nếu gặp lỗi, sử dụng Live Server của VS Code hoặc máy chủ static khác. Để mở từ iPad trên cùng Wi-Fi dùng địa chỉ IP nội bộ của Mac, nhưng PWA chỉ thêm vào màn hình chính/Service Worker đáng tin cậy khi triển khai HTTPS, ví dụ GitHub Pages.

## Chi phí / kết nối mạng

- **OCR cơ bản:** 0₫ phí API. Tesseract.js được tải từ jsDelivr khi nhấn OCR lần đầu và có thể tải thêm gói ngôn ngữ. Nên có Internet khi dùng OCR; việc nó có chạy offline sau lần đầu phụ thuộc cache trình duyệt. OCR không gửi ảnh tới máy chủ của chúng tôi (không có máy chủ của chúng tôi). Thư viện được tải từ CDN, dữ liệu OCR xử lý trong trình duyệt.
- **Gợi ý offline, lưu Journal, xuất JSON:** Không yêu cầu AI backend; app shell có thể hoạt động offline khi đã được lưu cache qua Service Worker.
- **AI Vision:** cần Internet và Cloudflare Worker/Gemini API. Cloudflare có gói miễn phí, Gemini có hạn mức API miễn phí cho một số model/tài khoản/vùng; không đảm bảo bạn luôn được miễn phí. Xem https://ai.google.dev/gemini-api/docs/pricing .
- Hạn mức Gemini API miễn phí có thể cho phép dữ liệu được sử dụng để cải thiện sản phẩm của Google; đừng gửi ảnh chứa thông tin riêng tư ngoài trò chơi.

## Kết nối AI nâng cao bằng Cloudflare Worker riêng (tùy chọn)

> Tránh đưa Gemini API key trực tiếp vào frontend. Không đăng key vào GitHub, không dùng key trên website công khai.

1. Tạo tài khoản https://dash.cloudflare.com, vào **Workers & Pages** và tạo Worker mới.
2. Thay code Worker mặc định bằng nội dung `worker/ai-worker.js`, sau đó Deploy. Hoặc dùng `wrangler` với mẫu `worker/wrangler.toml.example` (đổi tên thành `wrangler.toml`, sửa ALLOWED_ORIGIN rồi `npx wrangler deploy`).
3. Vào **Worker → Settings → Variables and Secrets**, tạo hai **Secrets**:
   - `GEMINI_API_KEY`: tạo tại https://aistudio.google.com/apikey (kiểm tra điều khoản và hạn mức trước).
   - `APP_ACCESS_TOKEN`: tự tạo chuỗi ngẫu nhiên dài tối thiểu 24 ký tự, khác mật khẩu tài khoản của bạn.
4. (Khuyên dùng) Đặt Variable `ALLOWED_ORIGIN` thành origin GitHub Pages, ví dụ `https://tenban.github.io` (**không** thêm `/repo` hoặc dấu `/` cuối). Có thể đặt `GEMINI_MODEL=gemini-2.5-flash`.
5. Sau khi triển khai, kiểm tra `https://WORKER.tenban.workers.dev/health` có trả JSON `ok:true`.
6. Mở WuWa AI → **Cài đặt AI** → nhập URL đầy đủ `https://WORKER.tenban.workers.dev/analyze`, mật khẩu trong `APP_ACCESS_TOKEN`, đồng ý gửi ảnh → lưu URL. Quay lại **Phân tích** → chụp ảnh → bấm **Phân tích bằng AI**.

**Lưu ý:** Token Worker chỉ nằm trong RAM tab hiện tại và phải nhập lại nếu tab bị tải lại. API key chỉ nằm trong Cloudflare Secret; ảnh được gửi tới Worker và Google khi bạn chủ động dùng AI. Worker là **proxy mẫu cho một người dùng**, chưa có rate limiting chặt chẽ hay xác thực người dùng nhiều thiết bị; nếu chia sẻ rộng rãi cần bổ sung bảo mật, hạn mức và kiểm soát chi phí. Cloudflare Secrets lưu phía backend, không gửi Gemini key về trình duyệt.

## Cấu trúc source

```
index.html          Giao diện chính
styles.css          CSS responsive iPad/iPhone
app.js              Upload ảnh, OCR, lưu quest, AI tùy chọn
logic.mjs           Bộ phân tích nhiệm vụ offline
manifest.webmanifest PWA metadata
sw.js               Cache app shell
icons/              Icon 192px/512px
worker/ai-worker.js Proxy Cloudflare Worker cho Gemini API
worker/wrangler.toml.example  Mẫu cấu hình
```

## Kiểm tra

Chạy `node tests/test-logic.mjs` để kiểm tra các quy tắc offline. Mở ứng dụng qua HTTPS/localhost để test thực tế upload và OCR trên Safari. Không có cuộc gọi API Gemini thực trong test vì không có key.

## Quyền riêng tư

- Không yêu cầu tài khoản game.
- Tiến độ và văn bản nhiệm vụ được lưu bằng `localStorage` của trình duyệt, không sync xuyên thiết bị; dùng Export/Import JSON nếu cần.
- Ảnh không được lưu vào Journal; tải lại trang sẽ xóa ảnh đang chọn.
- OCR chỉ nhận diện văn bản. Nếu gửi ảnh AI online, việc chia sẻ phải được xác nhận trong Cài đặt AI.
- Không tự động chiến đấu, auto farm, giả lập thao tác điều khiển trong game.
