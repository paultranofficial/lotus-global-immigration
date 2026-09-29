# Lotus Global Immigration — Website

Website giới thiệu Lotus Global Immigration: học healthcare và làm đẹp tại Singapore, làm nền tảng hướng tới nghề nghiệp tại Mỹ, Canada và Châu Âu.

Website tĩnh (HTML, CSS, JavaScript thuần). Toàn bộ chữ và ảnh nằm trong `content.json`; trang `index.html` (tiếng Việt), `en/index.html` (tiếng Anh) và `chinh-sach-du-lieu.html` được dựng từ đó. Link cũ dạng `?lang=en` tự chuyển sang `/en/`.

## Sửa nội dung: trang quản trị

Vào **https://www.lotusmigrate.com/admin/** và đăng nhập bằng GitHub token (hướng dẫn tạo token có ngay trên trang). Ở đó có thể:

- sửa chữ và tiêu đề, cả tiếng Việt lẫn tiếng Anh;
- tải ảnh mới lên (ảnh tự thu nhỏ, lưu vào `assets/uploads/`);
- đổi hotline/Zalo, bật tắt thanh thông báo trên cùng;
- thêm, xóa, đổi thứ tự lĩnh vực, nghề, điểm đến, câu hỏi, khẩu hiệu…

Mọi thay đổi hiện ngay ở khung xem trước. Bấm **Xuất bản** thì trang quản trị ghi `content.json`, các trang HTML và ảnh mới thành một commit lên `main`; GitHub Pages cập nhật website sau 1–2 phút. Bản nháp chưa xuất bản được giữ trong trình duyệt.

Token là của riêng từng người, chỉ lưu trong trình duyệt, không nằm trong repo. Token nên giới hạn đúng repo này với quyền *Contents: Read and write*.

## Cấu trúc

| Tệp | Vai trò |
| --- | --- |
| `content.json` | Toàn bộ nội dung (chữ VI/EN, ảnh, hotline, thông báo) |
| `render.js` | Dựng HTML từ `content.json`; dùng chung cho trang quản trị và `build.cjs` |
| `build.cjs` | Dựng lại trang trên máy: `node build.cjs` |
| `admin/index.html` | Trang quản trị nội dung |
| `index.html`, `en/index.html`, `chinh-sach-du-lieu.html` | Trang được dựng ra — **không sửa tay**, sửa `content.json` rồi dựng lại |
| `style.css`, `layout-v2.css`, `layout-v3.css`, `layout-v5.css`, `lotus-spirit.css`, `languages.css`, `lotus-form.css` | Giao diện, theo thứ tự nạp |
| `app-v3.js` | Menu, hộp thoại chi tiết (đọc dữ liệu từ `#lotus-data` trong trang) |
| `layout-v2.js` | Bộ lọc nghề nghiệp, nút tắt chuyển động, hiệu ứng hiện dần |
| `layout-v4.js` | Thanh tiến độ cuộn, hiệu ứng thẻ |
| `lotus-form.js` | Form tư vấn 4 bước, gửi về onestep-ai-crm |
| `languages.js` | Nút VI/EN (chuyển giữa `/` và `/en/`) |
| `assets/` | Logo và ảnh; ảnh tải lên từ trang quản trị nằm trong `assets/uploads/` |

Trong ô chữ, đặt chữ giữa hai dấu `*sao*` để in nghiêng màu hồng; xuống dòng trong tiêu đề sẽ thành ngắt dòng.

Khi sửa giao diện của một mục (thẻ HTML, class), sửa trong `render.js`, chạy `node build.cjs` rồi commit cả trang đã dựng.

## Xem trên máy

Chạy `npx serve .` (hoặc `python3 -m http.server`) rồi vào địa chỉ hiện ra. Trang quản trị chạy được ở máy nhưng khi xuất bản sẽ ghi thẳng lên GitHub.

## Đưa lên mạng

- **GitHub Pages:** mỗi lần đẩy code lên nhánh `main`, workflow `.github/workflows/pages.yml` tự đăng website. Cần bật một lần: Settings → Pages → Source: **GitHub Actions**.
- **Render:** trên render.com chọn New → Blueprint, chọn repo này. Render đọc `render.yaml` và tạo Static Site, không cần cấu hình thêm.

## Tên miền

Website chạy tại **https://www.lotusmigrate.com** (GitHub Pages, tên miền đăng ký tại Nhân Hòa).

| Loại | Tên | Giá trị |
| --- | --- | --- |
| CNAME | www | paultranofficial.github.io |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |

Tên miền được khai báo trong Settings → Pages → Custom domain.

## Nội dung

Ảnh chân dung là người mẫu minh họa. Mọi nội dung nhắc tới việc làm, thị thực hay định cư phải giữ câu lưu ý minh bạch (xem bộ nhận diện thương hiệu Lotus).
