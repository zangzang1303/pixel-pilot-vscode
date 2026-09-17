// test_remove_bg.mjs
// Chạy lệnh: node test_remove_bg.mjs [đường_dẫn_ảnh_hoặc_url]
import fs from 'fs';
import path from 'path';

// 1. Điền API Key của Runware (hoặc set biến môi trường RUNWARE_API_KEY)
const RUNWARE_API_KEY = process.env.RUNWARE_API_KEY || "YOUR_RUNWARE_API_KEY";

async function main() {
  if (RUNWARE_API_KEY === "YOUR_RUNWARE_API_KEY") {
    console.error("\n❌ LỖI: Vui lòng thay 'YOUR_RUNWARE_API_KEY' bằng API key thật từ Runware.ai (hoặc set RUNWARE_API_KEY)!");
    console.log("👉 Đăng ký tài khoản miễn phí nhận credits tại: https://runware.ai\n");
    process.exit(1);
  }

  // 2. Lấy input ảnh từ tham số dòng lệnh hoặc dùng ảnh mẫu mặc định
  const inputArg = process.argv[2] || "https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?w=800";
  let imageInput = inputArg;

  // Nếu input là đường dẫn file trong máy tính, chuyển sang Data URI Base64
  if (fs.existsSync(inputArg)) {
    const ext = path.extname(inputArg).toLowerCase().replace('.', '') || 'jpeg';
    const base64Data = fs.readFileSync(inputArg).toString('base64');
    imageInput = `data:image/${ext};base64,${base64Data}`;
    console.log(`📂 Đọc ảnh local: ${inputArg}`);
  } else {
    console.log(`🌐 Sử dụng URL ảnh: ${inputArg}`);
  }

  console.log("⏳ Đang gửi request tới Runware (Model: BiRefNet Matting)...");
  const startTime = Date.now();

  // 3. Chuẩn bị payload chuẩn theo tài liệu Runware API
  const payload = [
    {
      taskType: "removeBackground",
      taskUUID: crypto.randomUUID(),
      model: "runware:112@9", // BiRefNet Matting
      outputFormat: "PNG",     // Giữ kênh Alpha trong suốt
      outputType: "dataURI",   // Nhận trực tiếp ảnh Base64 trả về
      inputs: {
        image: imageInput
      }
    }
  ];

  try {
    const response = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RUNWARE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    const duration = Date.now() - startTime;

    if (result.errors && result.errors.length > 0) {
      console.error("❌ Lỗi từ Runware API:", result.errors);
      return;
    }

    // 4. Bóc tách dữ liệu và lưu ảnh kết quả
    const taskResult = result.data ? result.data[0] : result[0];
    const outputDataURI = taskResult?.imageURL || taskResult?.dataURI || taskResult?.image;

    if (outputDataURI) {
      const outputPath = path.resolve("./output_nobg.png");
      if (outputDataURI.startsWith("data:image")) {
        const base64Clean = outputDataURI.split(',')[1];
        fs.writeFileSync(outputPath, Buffer.from(base64Clean, 'base64'));
      } else {
        // Nếu trả về URL
        const imgRes = await fetch(outputDataURI);
        const buffer = await imgRes.arrayBuffer();
        fs.writeFileSync(outputPath, Buffer.from(buffer));
      }
      console.log(`\n🎉 TÁCH NỀN THÀNH CÔNG!`);
      console.log(`⏱️ Thời gian xử lý: ${duration}ms`);
      console.log(`💾 Ảnh đã lưu tại: ${outputPath}\n`);
    } else {
      console.log("Phản hồi thô từ API:", JSON.stringify(result, null, 2));
    }
  } catch (err) {
    console.error("❌ Lỗi kết nối mạng:", err.message);
  }
}

main();
