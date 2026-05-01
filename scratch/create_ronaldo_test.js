const http = require('http');

const makeRequest = (options, data) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch(e) {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
};

const createRonaldoTest = async () => {
  try {
    console.log('Creating Test...');
    const testData = {
      title: 'Kiểm tra kiến thức bóng đá: Sự nghiệp Cristiano Ronaldo',
      description: 'Bài kiểm tra gồm các câu hỏi về thành tích, các câu lạc bộ và kỷ lục của siêu sao bóng đá Cristiano Ronaldo.',
      duration: 15,
      test_type: 'video_ai'
    };
    
    const test = await makeRequest({
      hostname: 'localhost',
      port: 5001,
      path: '/api/ai-tests/tests',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, testData);
    
    const testId = test.id;
    console.log('Created Test ID:', testId);

    const questions = [
      {
        content: 'Ronaldo đã từng thi đấu cho những câu lạc bộ bóng đá chuyên nghiệp nào trong sự nghiệp của mình (tính đến năm 2023)?',
        type: 'essay',
        difficulty: 'medium',
        expected_answer: 'Sporting CP, Manchester United, Real Madrid, Juventus, Al Nassr.',
        keywords: 'Sporting, Manchester United, MU, Real Madrid, Juventus, Al Nassr'
      },
      {
        content: 'Nêu tên ít nhất 3 kỷ lục cá nhân nổi bật mà Cristiano Ronaldo đang nắm giữ.',
        type: 'essay',
        difficulty: 'hard',
        expected_answer: 'Cầu thủ ghi bàn nhiều nhất lịch sử bóng đá nam, Vua phá lưới mọi thời đại của Real Madrid, Cầu thủ ghi bàn nhiều nhất lịch sử Champions League, Vua phá lưới mọi thời đại ở cấp độ ĐTQG.',
        keywords: 'nhiều bàn thắng nhất, vua phá lưới, Champions League, C1, Real Madrid, Đội tuyển quốc gia'
      },
      {
        content: "Ronaldo đã giành được bao nhiêu Quả Bóng Vàng (Ballon d'Or) trong sự nghiệp?",
        type: 'essay',
        difficulty: 'easy',
        expected_answer: 'Ronaldo đã giành được 5 Quả Bóng Vàng.',
        keywords: '5, năm'
      }
    ];

    for (let i = 0; i < questions.length; i++) {
      console.log('Creating Question', i+1);
      const q = await makeRequest({
        hostname: 'localhost',
        port: 5001,
        path: '/api/ai-tests/questions',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, questions[i]);
      
      console.log('Linking Question', q.id, 'to Test', testId);
      await makeRequest({
        hostname: 'localhost',
        port: 5001,
        path: `/api/ai-tests/tests/${testId}/questions/${q.id}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { order_index: i });
    }

    console.log('Finished successfully!');
  } catch (e) {
    console.error('Error:', e);
  }
};

createRonaldoTest();
