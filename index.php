<?php
// ১. টেলিগ্রাম থেকে আসা Webhook ডাটা গ্রহণ
$content = file_get_contents("php://input");
$update = json_decode($content, true);

// ২. কনফিগারেশন
$mainGroupId = '-1004440767818'; // মেইন চ্যানেল/গ্রুপ আইডি

// Render-এর Node.js সার্ভারের আসল URL
$nodeServerUrl = 'https://hutggh.onrender.com/process-post'; 

if (isset($update['message'])) {
    $message = $update['message'];
    $chatId = (string)$message['chat']['id'];
    
    $text = '';
    if (isset($message['text'])) {
        $text = $message['text'];
    } elseif (isset($message['caption'])) {
        $text = $message['caption'];
    }

    // ৩. মেইন গ্রুপ চেক
    if ($chatId === $mainGroupId) {
        
        // ৪. ফিল্টারিং: ✅ এবং http দুটিই থাকতে হবে
        if (mb_strpos($text, '✅') !== false && mb_strpos($text, 'http') !== false) {
            
            // Node.js ব্যাকএন্ডে cURL করে ডাটা পাঠানো
            $ch = curl_init($nodeServerUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query(['text' => $text]));
            curl_setopt($ch, CURLOPT_TIMEOUT, 5);
            
            curl_exec($ch);
            curl_close($ch);
        }
    }
}

echo "OK";
?>
