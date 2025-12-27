# Geo2LaTeX Lite (Demo)

Bản web *siêu cơ bản* để bạn trace hình học phẳng (điểm/đoạn thẳng/đa giác/đường tròn/góc) và xuất ra LaTeX (TikZ).

> Zalo: 0377733703  
> Muốn mua bản cải tiến để chuyển đổi hầu như tất cả hình (tự động nhận dạng tốt hơn, nhiều dạng hình hơn) thì liên hệ Zalo.

## Chạy thế nào?

### Cách 1 (dễ nhất)
Mở `index.html` bằng Chrome/Edge.

### Cách 2 (server tĩnh tuỳ chọn)
Bạn có thể dùng Node để phục vụ file tĩnh:

```bash
npm i
node server.js
```

Mở: http://localhost:5173

## Dùng sao?

- Bấm **Tải ảnh nền** (tuỳ chọn) để đặt ảnh làm background và click theo ảnh.
- Chọn tool:
  - **Điểm**: click để thêm điểm.
  - **Đoạn thẳng**: click 2 điểm.
  - **Đa giác**: click nhiều điểm -> bấm “Hoàn tất đa giác”.
  - **Đường tròn**: click tâm -> click điểm trên đường tròn.
  - **Góc**: click A-B-C để tạo cung góc tại B.
  - **Đổi nhãn**: click điểm để đổi tên.
- Copy hoặc tải `.tex`.

## Ghi chú
- Lite không tự nhận dạng hình từ ảnh. Nó là công cụ “trace”.
- TikZ output dùng `\coordinate` cho điểm và `\draw` cho hình.


## Giới hạn bản Lite
- Bản Lite chỉ hỗ trợ **hình học phẳng đơn giản** và thao tác theo kiểu “trace”.
- Muốn **phức tạp** và **chính xác** hơn (tự động nhận diện nhiều dạng hình, ít sai hơn) thì nên nâng cấp.

## Dịch vụ theo yêu cầu
- Có nhận **viết công cụ theo yêu cầu**. Cam kết **làm được mới nhận tiền**.
- Zalo: 0377733703

- (PRO) Tự chỉnh sửa: làm sạch hình, tự chỉnh sửa LaTeX.
