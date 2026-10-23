# WuWa AI Assistant v2.0.1 — Gemini Vision + tìm walkthrough

Ứng dụng Web/PWA hỗ trợ người chơi Wuthering Waves trên iPhone/iPad. Điểm khác với v1.x: v2 **đưa AI lên bước đầu**, đọc ảnh trực tiếp bằng Gemini 2.5 Flash và cho phép Gemini tra hướng dẫn quest bằng Google Search Grounding. Khi có nguồn, ứng dụng hiện đường dẫn tham khảo. Không điều khiển game, không tự động chơi.

## THỰC TẾ ĐÃ HOÀN THÀNH

- Giao diện upload ảnh → **Giải nhiệm vụ bằng AI** (không cần OCR trước).
- Worker bảo vệ Gemini API key bằng Secret; mật khẩu Worker riêng.
- Prompt đối chiếu ảnh với walkthrough bằng Google Search; trả JSON bước bằng tiếng Việt.
- Hiển thị link nguồn **chỉ khi API trả grounding metadata** hoặc khi khớp mẫu walkthrough xác minh sẵn. Không giả nhận đã tra cứu.
- Ẩn dãy UID trong OCR tại Worker, và tuỳ chọn che góc dưới bên phải của ảnh trước khi gửi (bật sẵn).
- Giữ ngữ cảnh quest trước để hỗ trợ ảnh tiếp theo; Journal cũ vẫn còn trên máy.
- Bộ kiểm thử logic + Worker mock qua Node.js. **Chưa có API key thật nên chưa chạy kiểm thử mạng Gemini/Worker thực trên iPad.**

## BƯỚC 1 — Cập nhật website GitHub Pages (trên Mac)

1. Giải nén `WuWa_AI_v2_0_1_Update.zip`.
2. Vào **https://github.com/Thinhfree/wuwa-ai-assistant** → `Add file` → `Upload files`.
3. Kéo **5 file ở cấp ngoài (`index.html`, `app.js`, `styles.css`, `sw.js`, `package.json`) + cả thư mục `worker`** của ZIP mới vào ô upload, đảm bảo `worker/ai-worker.js` nằm đúng đường dẫn; ghi đè file trùng tên.
4. Bấm `Commit changes`.
5. Không cần bật lại GitHub Pages. Vào Safari mở **https://thinhfree.github.io/wuwa-ai-assistant/?v=2.0.1** và đợi trang hiển thị `V2.0.1`.
6. Nếu app trên màn hình chính vẫn hiện bản cũ: đóng app, mở đường dẫn trên bằng **Safari**, tải lại trang rồi mở app lần nữa.

> Nếu trình upload GitHub không thay thế file trùng tên, mở từng file trong repo → biểu tượng bút chì Edit → dán nội dung từ file mới → Commit changes. Không để mã nguồn nằm trong thư mục `WuWa_AI_v2_...` lồng bên trong repo: `index.html` phải ở root.

## BƯỚC 2 — Lấy Gemini API key (MIỄN PHÍ CÓ HẠN MỨC)

1. Mở **https://aistudio.google.com/apikey**, đăng nhập tài khoản Google.
2. Chọn tạo API key trong project có quyền Gemini API (Google có thể yêu cầu chọn/tạo project).
3. Chọn model mặc định `gemini-2.5-flash`. Trang giá và hạn mức: https://ai.google.dev/gemini-api/docs/pricing .
4. **Không đưa API key lên GitHub, website, hoặc gửi cho người khác.** Bạn chỉ nhập key vào Cloudflare Secret ở Bước 3.
5. Hạn mức miễn phí phụ thuộc khu vực, tài khoản, quota; Google có thể thay đổi. Search Grounding cho 2.5 Flash hiện có hạn mức miễn phí đủ điều kiện. Không bật billing nếu bạn muốn tránh phí phát sinh ngoài ý muốn.

## BƯỚC 3 — Tạo Worker miễn phí trên Cloudflare

1. Truy cập **https://dash.cloudflare.com** → đăng ký/đăng nhập → `Workers & Pages`.
2. Chọn **Create** → **Worker** (tên ví dụ `wuwa-quest-ai`) → **Deploy**.
3. Chọn **Edit code** trên Worker, thay mã mẫu bằng **toàn bộ nội dung file `worker/ai-worker.js`** từ ZIP, bấm **Deploy**.
4. Vào **Settings → Variables and Secrets**. Thêm các biến sau (phân biệt kiểu):

| Name | Type | Value |
|---|---|---|
| `GEMINI_API_KEY` | **Secret** | API key bạn vừa tạo ở AI Studio |
| `APP_ACCESS_TOKEN` | **Secret** | Mật khẩu do bạn tự tạo, nên là chuỗi ngẫu nhiên dài ít nhất 24 ký tự |
| `ALLOWED_ORIGIN` | **Plaintext** | `https://thinhfree.github.io` (không thêm dấu `/` cuối, không thêm `/wuwa-ai-assistant`) |
| `GEMINI_MODEL` | **Plaintext** (không bắt buộc) | `gemini-2.5-flash` |

5. Bấm **Deploy** hoặc lưu và triển khai phiên bản Worker mới.
6. Worker sẽ có URL tương tự `https://wuwa-quest-ai.TENBAN.workers.dev`. Hãy nhớ URL này. Thử mở URL **cộng `/health`** bằng Safari, phải thấy JSON có `"ok":true` và `"configured":true`. Nếu `configured:false` thì thiếu Secrets.

Để tạo mật khẩu ngẫu nhiên trên Mac, mở Terminal chạy `openssl rand -hex 24` rồi lưu giá trị vào một nơi riêng. **Không dùng cùng mật khẩu đăng nhập Google/GitHub.**

> Worker và website là 2 thứ khác nhau: GitHub Pages chỉ lưu giao diện và chạy JS trên iPad, Cloudflare Worker giữ key và kết nối Google. Chỉ upload **mã Worker**, không upload giá trị key hoặc mật khẩu.

## BƯỚC 4 — Kết nối AI trên iPad/iPhone

1. Mở **https://thinhfree.github.io/wuwa-ai-assistant/?v=2.0.1** trên Safari, kiểm tra chữ `V2.0.1`.
2. Vào tab **Cài đặt AI**:
   - Địa chỉ Worker: `https://wuwa-quest-ai.TENBAN.workers.dev/analyze` (thay bằng URL thực của bạn).
   - Mật khẩu: giá trị `APP_ACCESS_TOKEN`.
   - Tick ô **Tôi đồng ý gửi ảnh...**.
   - Bấm **Lưu địa chỉ Worker**, sau đó **Kiểm tra kết nối**.
3. Quay lại tab **Phân tích** → chọn ảnh chụp rõ quest → nhấn nút lớn **✧ GIẢI NHIỆM VỤ BẰNG AI →**.
4. Kết quả hiện tên/mục tiêu, 2–8 bước bằng tiếng Việt, đánh giá độ tin cậy và **nguồn tham khảo nếu tìm được**.
5. Khi đã làm bước 1 trong game, chụp ảnh mới, upload và bấm AI lần nữa. App gửi ngữ cảnh lần trước để tránh bắt đầu lại.

## TEST CHUẨN — Nhiệm vụ đã từng gặp

Dùng screenshot từ **Gold Suspended in Shadows** với mục tiêu **Walk around the venue to see if you can meet your friends**. Walkthrough trên https://wutheringwaves.fandom.com/wiki/Gold_Suspended_in_Shadows ghi đó là bước 45; sau đó tới bước 46 (theo Sigrika lên tầng hai) và 47 (tìm Lucilla). Bản v2 có một mẩu dữ liệu kiểm chứng sẵn cho **đúng mục tiêu này**, ngoài khả năng tra Internet chung. Lưu ý: người chơi phải hoàn thành bước hiện tại trước khi chuyển sang bước tiếp.

## VÌ SAO CHƯA THỂ NÓI “ĐÃ GIẢI ĐƯỢC MỌI QUEST”

- Worker cần tài khoản Cloudflare của bạn và Gemini API key cá nhân, không có key trong mã nguồn.
- Gemini Search đôi khi không tìm được tài liệu/không trả metadata, app sẽ báo **Chưa có nguồn web**, thay vì tự bịa.
- Một số puzzle cần nhiều ảnh (bố cục toàn cảnh, cửa, cơ quan, bản đồ), một ảnh không đủ.
- Trả lời có thể sai dù có nguồn, hãy đối chiếu với game.
- UID được che theo vùng thường gặp, **không đảm bảo loại bỏ mọi vị trí UID**; hãy tự che trước nếu cần.
- Không có tính năng tự bấm game hoặc tự hoàn thành nhiệm vụ.

## KHẮC PHỤC LỖI NHANH

| Thấy gì | Cách xử lý |
|---|---|
| `V1.2` trên iPad | Safari mở link `?v=2.0.1`, làm mới; nếu cũ xem GitHub Actions triển khai chưa xong |
| Bấm AI chuyển sang Cài đặt | Chưa nhập Worker URL/mật khẩu hoặc chưa tick đồng ý |
| `configured:false` | Cloudflare chưa có đủ `GEMINI_API_KEY`, `APP_ACCESS_TOKEN` (Type Secret) |
| Lỗi CORS / Origin | `ALLOWED_ORIGIN` phải chính xác `https://thinhfree.github.io` |
| Lỗi 401 | Mật khẩu `APP_ACCESS_TOKEN` trên web không khớp Cloudflare |
| Lỗi 429 | Hết hạn mức Gemini / quá nhiều lượt; xem quota AI Studio |
| Lỗi model/google_search | Kiểm tra `GEMINI_MODEL` là model hỗ trợ search và quyền API tương ứng |
| Có lời giải nhưng không có link nguồn | AI chưa grounding thành công. Hãy điền tên quest đúng trong ô Tên nhiệm vụ rồi thử lại |
| OCR đọc sai | AI Vision không bắt buộc phải OCR, chọn ảnh chụp rõ rồi bấm nút lớn AI |

## KIỂM THỬ DÀNH CHO NGƯỜI MUỐN XEM MÃ NGUỒN

Nếu Mac đã cài Node.js 18+, trong thư mục dự án chạy:

```bash
node tests/test-logic.mjs
node tests/test-worker.mjs
node tests/test-ui-contract.mjs
# Nếu đã cài Python + Playwright + Pillow và Chromium:
python tests/test-browser-smoke.py
```

Các test dùng Gemini giả lập, **không tính phí, không gọi Gemini API thật**.

## An toàn / riêng tư

- Chỉ Cloudflare Worker giữ API key dưới dạng Secret; URL Worker được lưu trong localStorage, token chỉ giữ trong RAM phiên app.
- Screenshot gửi qua HTTPS tới Worker rồi tới Google Gemini khi bạn nhấn phân tích bằng AI (nếu bật đồng ý). Google có thể dùng dữ liệu từ API Free Tier để cải thiện sản phẩm theo điều khoản của họ.
- Cloudflare Worker hiện không ghi nội dung ảnh vào database, nhưng các dịch vụ phía trên vẫn có chính sách lưu trữ riêng.
- Đừng đăng ký API trả phí nếu bạn chỉ muốn thử free; Worker công khai cần mật khẩu mạnh và nên thiết lập hạn mức để tránh bị người khác lạm dụng.

## KIỂM ĐỊNH v2.0.1

- Sửa hiển thị bước bị đánh số trùng trên checklist.
- Khi chọn nhanh nhiều ảnh, chỉ xử lý ảnh được chọn gần nhất, tránh ảnh cũ ghi đè ảnh mới.
- Worker tự ngắt yêu cầu Gemini nếu quá 50 giây và báo lỗi thay vì để ứng dụng treo.
- Đổi cache PWA sang v2.0.1 để tránh dính phiên bản cũ.
- Đã chạy test Node, test hợp đồng frontend, test Worker mock, test trình duyệt Chromium (UI, ảnh, Journal, Gemini giả lập), kiểm tra ZIP. **Chưa chạy kết nối Gemini thật hoặc Safari trên iPad thực tế** vì không có API key của chủ tài khoản.
