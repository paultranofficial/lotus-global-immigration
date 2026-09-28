# Lotus Global Immigration — Website

Website giới thiệu Lotus Global Immigration: học healthcare và làm đẹp tại Singapore, làm nền tảng hướng tới nghề nghiệp tại Mỹ, Canada và Châu Âu.

Website tĩnh (HTML, CSS, JavaScript thuần), không cần build. Có hai ngôn ngữ Việt và Anh (nút VI/EN, hoặc thêm `?lang=en` vào đường dẫn).

## Cấu trúc

| Tệp | Vai trò |
| --- | --- |
| `index.html` | Trang chính |
| `style.css`, `layout-v2.css`, `layout-v3.css`, `layout-v5.css`, `lotus-spirit.css`, `languages.css` | Giao diện, theo thứ tự nạp |
| `app-v3.js` | Menu, hộp thoại chi tiết, form ghi chú tư vấn |
| `layout-v2.js` | Mục Nghề nghiệp và bộ lọc |
| `layout-v4.js` | Ảnh nghề, thanh tiến độ cuộn, hiệu ứng |
| `notes.js` | Tạo và tải ghi chú tư vấn |
| `languages.js` | Bản dịch tiếng Anh và nút VI/EN |
| `assets/` | Logo và ảnh (đã nén cho web) |

## Xem trên máy

Mở `index.html` bằng trình duyệt, hoặc chạy `npx serve .` rồi vào địa chỉ hiện ra.

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
