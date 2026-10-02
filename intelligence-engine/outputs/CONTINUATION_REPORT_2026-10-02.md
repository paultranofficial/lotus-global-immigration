# OneStep: bàn giao phần tiếp tục ngày 02/10/2026

Repo: `paultranofficial/lotus-global-immigration`, thư mục `intelligence-engine`.

## Phần đã triển khai

- API lấy context, phân tích hồ sơ, chuẩn bị proposal và điều phối Lead Agent.
- Cập nhật nguồn HTML/PDF, nhận diện thay đổi, hàng chờ duyệt và tìm kiếm tài liệu kèm citation.
- Policy có bằng chứng, reviewer, phạm vi hồ sơ, ngày hiệu lực và ngày kiểm chứng; các điều kiện định lượng được lưu trong dữ liệu.
- Snapshot hồ sơ giữ nguyên nội dung và hash; cảnh báo khi rule, tài liệu hoặc nguồn chờ duyệt thay đổi.
- API key riêng cho Agent và reviewer; migration có checksum; khởi động không ghi đè policy đã cập nhật.
- Cấu hình Render dùng persistent disk; CLI backup; kiểm thử và GitHub Actions.
- Adapter server để nối CRM hiện tại, giữ nguyên contract form và không gửi tên/email/điện thoại vào engine.

## Kiến thức hiện có

38 nguồn đăng ký; 12 phiên bản policy đã kiểm chứng bằng trang chính thức trong phiên làm việc; 5 bản ghi trường/chương trình/tuyển sinh/học bổng; 30 rule nền tảng còn chờ duyệt. Có 11 phiên bản policy áp dụng ngày 02/10/2026; một phiên bản UK Graduate bắt đầu ngày 01/01/2027.

Bản JSON cho AI: [ONESTEP_REVIEWED_KNOWLEDGE.json](ONESTEP_REVIEWED_KNOWLEDGE.json). Đây là dữ liệu đã cấu trúc có nguồn, ngày và phạm vi áp dụng; hãy lọc đúng thời gian và loại hồ sơ trước khi dùng. Các bản tóm tắt có nhãn rõ ràng và không được xem là toàn văn nguồn.

Phạm vi vẫn chưa bao phủ đầy đủ lịch sử ba năm hoặc toàn bộ trường/ngành/học bổng của 11 thị trường. Chi tiết nằm trong [coverage](../docs/KNOWLEDGE_COVERAGE.md).

## Vận hành và tích hợp

Kiểm thử local: 28 Python tests và 4 Node adapter tests đạt; build website chạy thành công và không thay đổi HTML sinh ra. Kiểm tra backup SQLite và YAML Render cũng đạt. GitHub Actions đã được cấu hình để chạy các kiểm tra này trên Python 3.12.

- [Hướng dẫn cập nhật policy](../docs/POLICY_EDITOR_GUIDE.md)
- [Hướng dẫn Render và backup](../docs/RENDER_RUNBOOK.md)
- [Hợp đồng API và tích hợp CRM](../docs/AGENT_INTEGRATION.md)

Live ingestion đã tải được GOV.UK. IRCC bị timeout, Migri trả HTTP 403; hệ thống giữ lại lỗi để reviewer xử lý. Không tự nâng nội dung crawl thành policy đã duyệt.

Chưa xác minh triển khai Render: trình duyệt đang yêu cầu đăng nhập. Backend CRM nằm ngoài repo này nên chưa gắn adapter vào intake production. Agent APIs cung cấp dữ liệu cho AI hiện có; chúng chưa tự gọi một mô hình LLM. Retrieval hiện dùng FTS5/BM25; semantic embeddings và PostgreSQL là các phần tiếp theo.
