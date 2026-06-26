import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Animated,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

// 簡易AI応答データベース（キーワード対応＆ランダム返答）
const AI_RESPONSES = {
  greetings: ['ピピ！こんにちは！今日もよろしくね！', 'ピュイ！起きてたよ！お話ししよう！', 'クーン、なでなでして〜！'],
  happy: ['ウキウキするなぁ！', 'あなたといると、とっても幸せ！', 'ピュイピュイ！ダンスしちゃう！'],
  sad: ['ちょっと寂しいな…', 'お腹がすくと力が出ないよぅ', 'ピピ…もっとかまってほしいな'],
  default: [
    'ピピ！その言葉、覚えておくね！',
    'ふむふむ、もっと教えて！',
    'あなたの声、とっても優しくて好きだな！',
    'ピュイ！明日は晴れるかな？',
  ],
};

// 自動翻訳（Google翻訳等）の誤動作を防止するため、ゼロ幅スペースを含めたテキストを定義
const TRANSLATION_SAFE_TEXT = {
  care: "お" + "\u200b" + "世" + "\u200b" + "話" + "\u200b" + "を" + "\u200b" + "す" + "\u200b" + "る",
  feed: "お" + "\u200b" + "食" + "\u200b" + "事",
  play: "遊" + "\u200b" + "ぶ",
  gift: "プ" + "\u200b" + "レ" + "\u200b" + "ゼ" + "\u200b" + "ン" + "\u200b" + "ト",
  cancel: "キ" + "\u200b" + "ャ" + "\u200b" + "ン" + "\u200b" + "セ" + "\u200b" + "ル",
};

// Web用のCSSアニメーション定義
const webStyles = `
  @keyframes float {
    0% { transform: translateY(0px); }
    50% { transform: translateY(-15px); }
    100% { transform: translateY(0px); }
  }
  @keyframes breath {
    0% { transform: scaleX(1) scaleY(1); }
    50% { transform: scaleX(1.05) scaleY(0.95); }
    100% { transform: scaleX(1) scaleY(1); }
  }
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    30% { transform: translateY(-25px); }
    50% { transform: translateY(0); }
    70% { transform: translateY(-10px); }
  }
  @keyframes halo-glow {
    0%, 100% { opacity: 0.8; filter: drop-shadow(0 0 5px #ffd700); }
    50% { opacity: 1; filter: drop-shadow(0 0 12px #ffae00); }
  }
  @keyframes devil-glow {
    0%, 100% { filter: drop-shadow(0 0 2px #ff0055); }
    50% { filter: drop-shadow(0 0 8px #ff00ff); }
  }
  @keyframes bubble-in {
    0% { opacity: 0; transform: scale(0.8) translateY(10px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }
  @keyframes slide-up {
    0% { transform: translateY(100%); }
    100% { transform: translateY(0); }
  }
  @keyframes fade-in {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }
  .web-floating {
    animation: float 4s ease-in-out infinite;
  }
  .web-breathing {
    animation: breath 4s ease-in-out infinite;
  }
  .web-bouncing {
    animation: bounce 0.8s ease-in-out;
  }
  .web-halo {
    animation: halo-glow 2s ease-in-out infinite;
  }
  .web-devil {
    animation: devil-glow 2s ease-in-out infinite;
  }
  .web-bubble {
    animation: bubble-in 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  }
  .web-slide-up {
    animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  .web-fade-in {
    animation: fade-in 0.25s ease-out forwards;
  }
`;

if (isWeb && typeof document !== 'undefined') {
  // 1. Google自動翻訳をサイト全体で無効化するメタタグを追加
  const meta = document.createElement('meta');
  meta.name = 'google';
  meta.content = 'notranslate';
  document.head.appendChild(meta);

  // 2. <html>要素自体に 'notranslate' クラスを付与（Chromeの強制自動翻訳対策）
  document.documentElement.classList.add('notranslate');

  // 3. Web用のCSSアニメーション定義を追加
  const style = document.createElement('style');
  style.type = 'text/css';
  style.textContent = webStyles;
  document.head.appendChild(style);
}

export default function App() {
  // --- 状態管理 ---
  const [petName, setPetName] = useState(''); // あもれもんの名前
  const [isNamed, setIsNamed] = useState(false); // 名前が登録されたかのフラグ
  const [nameInput, setNameInput] = useState(''); // 命名画面での入力テキスト

  const [hunger, setHunger] = useState(80); // お腹すき度 (0 - 100, 非表示)
  const [affection, setAffection] = useState(50); // なつき度 (0 - 100, 非表示)
  const [tokens, setTokens] = useState(8); // 行動権トークン (最大10, 非表示)
  const [nextRecoverySec, setNextRecoverySec] = useState(15); // トークン回復時間 (秒, 非表示)
  const [inputText, setInputText] = useState(''); // チャット入力
  
  // 吹き出しの状態
  const [bubbleText, setBubbleText] = useState('');
  const [bubbleVisible, setBubbleVisible] = useState(false);
  
  // 進化状態
  const [evolution, setEvolution] = useState('normal'); // normal, angel, devil
  const [actionCount, setActionCount] = useState(0); // アクションカウンター

  // メニュー・ポップアップ（モーダル）の状態
  const [isMenuVisible, setIsMenuVisible] = useState(false); // お世話メニューの表示
  const [isModalVisible, setIsModalVisible] = useState(false); // 回復ポップアップの表示
  const [isAdLoading, setIsAdLoading] = useState(false); // 動画広告読み込み中アニメーションフラグ
  const [purchaseStatus, setPurchaseStatus] = useState(''); // 課金処理のステータスメッセージ

  const [petEmotion, setPetEmotion] = useState('normal'); // 感情
  const [careScore, setCareScore] = useState(50); // お世話スコア
  const [isBouncing, setIsBouncing] = useState(false); // バウンド状態 (Web用)
  const [particles, setParticles] = useState([]); // お世話時のパーティクルエフェクト
  const [chatHistory, setChatHistory] = useState([]); // 会話履歴 (Geminiに渡す用)
  const [isTyping, setIsTyping] = useState(false); // AIが入力中（考えている）フラグ

  // --- アニメーション参照 ---
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleXAnim = useRef(new Animated.Value(1)).current;
  const scaleYAnim = useRef(new Animated.Value(1)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const bubbleTimerRef = useRef(null);

  // --- タイマーとアニメーションのセットアップ ---
  useEffect(() => {
    if (isWeb) return;

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -15, duration: 2000, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleXAnim, { toValue: 1.05, duration: 2000, useNativeDriver: true }),
          Animated.timing(scaleYAnim, { toValue: 0.95, duration: 2000, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scaleXAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(scaleYAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        ]),
      ])
    ).start();

    return () => {
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    };
  }, []);

  // 2. トークン自動回復タイマー
  useEffect(() => {
    if (!isNamed) return;
    if (tokens >= 10) {
      setNextRecoverySec(15);
      return;
    }

    const timer = setInterval(() => {
      setNextRecoverySec((prevSec) => {
        if (prevSec <= 1) {
          setTokens((t) => Math.min(10, t + 1));
          return 15;
        }
        return prevSec - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [tokens, isNamed]);

  // 3. お腹が徐々に空くタイマー (25秒ごとにお腹度-5)
  useEffect(() => {
    if (!isNamed) return;
    const hungerInterval = setInterval(() => {
      setHunger((prev) => {
        const nextHunger = Math.max(0, prev - 5);
        if (nextHunger <= 0) {
          setCareScore((score) => Math.max(0, score - 8));
        }
        return nextHunger;
      });
    }, 25000);

    return () => clearInterval(hungerInterval);
  }, [isNamed]);

  // --- ペットの表情・色の判定 ---
  useEffect(() => {
    if (petEmotion === 'eating') return;

    if (hunger < 30) {
      setPetEmotion('sad');
    } else if (affection > 80) {
      setPetEmotion('happy');
    } else {
      setPetEmotion('normal');
    }
  }, [hunger, affection, petEmotion]);

  // --- 吹き出し表示＆自動消去 (6秒) ---
  const triggerBubble = (text) => {
    if (bubbleTimerRef.current) {
      clearTimeout(bubbleTimerRef.current);
    }
    setBubbleText(text);
    setBubbleVisible(true);
    bubbleTimerRef.current = setTimeout(() => {
      setBubbleVisible(false);
    }, 6000);
  };

  const formatReply = (text) => {
    return text.replace(/あもれもん/g, petName || 'あもれもん');
  };

  // --- パーティクルエフェクトの発生ロジック ---
  const triggerParticles = (type) => {
    let emojis = [];
    if (type === 'feed') {
      emojis = ['🍖', '🍕', '🍙', '🍰', '✨', '😋'];
    } else if (type === 'play') {
      emojis = ['🪁', '🎈', '⚽', '🎵', '✨', '😆'];
    } else if (type === 'gift') {
      emojis = ['🎁', '💝', '💎', '🌟', '✨', '😍'];
    }

    const count = 8;
    const newParticles = [];

    for (let i = 0; i < count; i++) {
      const id = Math.random().toString(36).substring(7);
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
      const x = new Animated.Value(0);
      const y = new Animated.Value(0);
      const opacity = new Animated.Value(1);
      const scale = new Animated.Value(0.5);

      newParticles.push({ id, emoji, x, y, opacity, scale });
    }

    setParticles((prev) => [...prev, ...newParticles]);

    newParticles.forEach((p) => {
      const angle = Math.random() * 2 * Math.PI;
      const distance = 60 + Math.random() * 80;
      const targetX = Math.cos(angle) * distance;
      const targetY = Math.sin(angle) * distance - (15 + Math.random() * 20);

      Animated.parallel([
        Animated.timing(p.x, {
          toValue: targetX,
          duration: 800,
          useNativeDriver: !isWeb,
        }),
        Animated.timing(p.y, {
          toValue: targetY,
          duration: 800,
          useNativeDriver: !isWeb,
        }),
        Animated.timing(p.scale, {
          toValue: 1.4,
          duration: 400,
          useNativeDriver: !isWeb,
        }).start(() => {
          Animated.timing(p.scale, {
            toValue: 0.4,
            duration: 400,
            useNativeDriver: !isWeb,
          }).start();
        }),
        Animated.timing(p.opacity, {
          toValue: 0,
          duration: 800,
          useNativeDriver: !isWeb,
        }),
      ]).start(() => {
        setParticles((prev) => prev.filter((item) => item.id !== p.id));
      });
    });
  };

  // --- Gemini API (1.5 Flash) 呼び出し処理 ---
  const callGeminiAPI = async (userMessage) => {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) return null;

    // システム指示プロンプトの作成
    let systemInstruction = `あなたは「${petName || 'あもれもん'}」という名前のAIペット（架空の生き物）です。
ユーザーはあなたの飼い主（パートナー）です。
以下のルールに従って、ユーザーとチャットをしてください：
1. 返答は短く、スマートフォンのチャット用吹き出しに入るように、最大でも2〜3文（80文字程度）に収めてください。
2. ユーザーに対して親密で、愛情を持っている態度で接してください。
`;

    // 進化状態に応じた性格の追加
    if (evolution === 'angel') {
      systemInstruction += `
3. 現在、あなたは【エンジェル（天使）】の姿に進化しています。
4. 口調は丁寧で優しく、常にユーザーを温かく見守り、励ます天使のような態度で話してください。
5. 語尾には「〜ですね」「〜ですよ」「ふふっ👼」などを好んで使ってください。`;
    } else if (evolution === 'devil') {
      systemInstruction += `
3. 現在、あなたは【デビル（悪魔）】の姿に進化しています。
4. 口調はツンデレ、少し生意気で反抗的、だけど実はユーザーのことが大好きな悪魔の態度で話してください。
5. 語尾には「〜だぞ」「〜だし！」「フン、べ、別に…///😈」などを好んで使ってください。`;
    } else {
      systemInstruction += `
3. 現在、あなたは【ノーマル（通常）】の姿です。
4. 口調は無邪気で人懐っこく、素直で愛嬌のあるペットのような態度で話してください。
5. 語尾や感嘆符に「ピピ！」「ピュイ！」などを好んで使ってください。`;
    }

    // 会話履歴をGemini APIが受け入れる形式にフォーマット
    const formattedHistory = chatHistory.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));

    // 今回のメッセージを追加
    const contents = [
      ...formattedHistory,
      {
        role: 'user',
        parts: [{ text: userMessage }],
      },
    ];

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents,
            systemInstruction: {
              parts: [{ text: systemInstruction }],
            },
            generationConfig: {
              maxOutputTokens: 150,
              temperature: 0.8,
            },
          }),
        }
      );

      if (!response.ok) {
        console.error('Gemini API returned error code:', response.status);
        try {
          const errorData = await response.json();
          console.error('Gemini API Error Detail:', JSON.stringify(errorData));
        } catch (_) {
          try {
            const errorText = await response.text();
            console.error('Gemini API Error Text:', errorText);
          } catch (__) {}
        }
        return null;
      }

      const data = await response.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return reply ? reply.trim() : null;
    } catch (error) {
      console.error('Failed to call Gemini API:', error);
      return null;
    }
  };

  // --- アクションカウンターと進化チェック (合計5回お世話で進化) ---
  const checkEvolution = (currentActionCount, currentCareScore) => {
    if (evolution !== 'normal') return;

    const nextCount = currentActionCount + 1;
    setActionCount(nextCount);

    if (nextCount >= 5) {
      setTimeout(() => {
        if (currentCareScore >= 55) {
          setEvolution('angel');
          triggerBubble(`ピピ…！なんだか体がキラキラ光るよ…！【エンジェル${petName}】に進化した！👼`);
        } else {
          setEvolution('devil');
          triggerBubble(`ピピピッ！背中がムズムズする…！【デビル${petName}】に進化した！😈`);
        }
        setPetEmotion('happy');
        setHunger(100);
        setAffection(80);
      }, 1500);
    }
  };

  // --- アクション処理: 命名する ---
  const handleRegisterName = () => {
    if (!nameInput.trim()) return;
    const name = nameInput.trim();
    setPetName(name);
    setIsNamed(true);
    setPetEmotion('happy');

    if (isWeb) {
      setIsBouncing(true);
      setTimeout(() => {
        setIsBouncing(false);
        setPetEmotion('normal');
      }, 800);
    } else {
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -30, duration: 150, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]).start(() => setPetEmotion('normal'));
    }

    setTimeout(() => {
      triggerBubble(`ピピ！今日からぼくの名前は「${name}」だね！いっぱい遊んでね！❤️`);
    }, 200);
  };

  // --- アクション：お食事を与える ---
  const performFeed = () => {
    setIsMenuVisible(false);
    if (tokens <= 0) {
      setIsModalVisible(true);
      return;
    }

    setTokens((prev) => prev - 1);
    triggerParticles('feed');
    setHunger((prev) => Math.min(100, prev + 25));
    setAffection((prev) => Math.min(100, prev + 5));
    const nextCareScore = Math.min(100, careScore + 5);
    setCareScore(nextCareScore);

    setPetEmotion('eating');

    if (isWeb) {
      setIsBouncing(true);
      setTimeout(() => {
        setIsBouncing(false);
        setPetEmotion('happy');
        setTimeout(() => setPetEmotion('normal'), 2000);
      }, 800);
    } else {
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -30, duration: 150, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: -15, duration: 120, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]).start(() => {
        setPetEmotion('happy');
        setTimeout(() => setPetEmotion('normal'), 2000);
      });
    }

    triggerBubble(formatReply('モグモグ…！おいしい！あもーれ！🍖'));
    checkEvolution(actionCount, nextCareScore);
  };

  // --- アクション：一緒に遊ぶ ---
  const performPlay = () => {
    setIsMenuVisible(false);
    if (tokens <= 0) {
      setIsModalVisible(true);
      return;
    }

    setTokens((prev) => prev - 1);
    triggerParticles('play');
    setAffection((prev) => Math.min(100, prev + 12));
    const nextCareScore = Math.min(100, careScore + 6);
    setCareScore(nextCareScore);

    setPetEmotion('happy');
    if (isWeb) {
      setIsBouncing(true);
      setTimeout(() => {
        setIsBouncing(false);
        setPetEmotion('normal');
      }, 800);
    } else {
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -20, duration: 150, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]).start(() => setPetEmotion('normal'));
    }

    triggerBubble(formatReply('わーい！遊ぶの大好き！ピュイ！🪁'));
    checkEvolution(actionCount, nextCareScore);
  };

  // --- アクション：プレゼントをあげる ---
  const performGift = () => {
    setIsMenuVisible(false);
    if (tokens <= 0) {
      setIsModalVisible(true);
      return;
    }

    setTokens((prev) => prev - 1);
    triggerParticles('gift');
    setAffection((prev) => Math.min(100, prev + 25));
    const nextCareScore = Math.min(100, careScore + 12);
    setCareScore(nextCareScore);

    setPetEmotion('happy');
    if (isWeb) {
      setIsBouncing(true);
      setTimeout(() => {
        setIsBouncing(false);
        setPetEmotion('normal');
      }, 800);
    } else {
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -35, duration: 150, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]).start(() => setPetEmotion('normal'));
    }

    triggerBubble(formatReply('わぁ…！素敵なプレゼント！とっても嬉しいな！🎁❤️'));
    checkEvolution(actionCount, nextCareScore);
  };

  // --- アクション処理: 会話する (送信) ---
  const handleSendMessage = async () => {
    if (!inputText.trim() || isTyping) return;
    if (tokens <= 0) {
      setIsModalVisible(true);
      return;
    }

    const text = inputText;
    setInputText('');
    setIsTyping(true); // 送信中ローディングオン
    setTokens((prev) => prev - 1);

    setAffection((prev) => Math.min(100, prev + 8));
    const nextCareScore = Math.min(100, careScore + 2);
    setCareScore(nextCareScore);

    setPetEmotion('eating'); // 考えている表情

    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    let reply = '';

    // APIキーがあればGemini APIを呼ぶ
    if (apiKey) {
      const geminiReply = await callGeminiAPI(text);
      if (geminiReply) {
        reply = geminiReply;
        // 履歴を更新（最新5往復までに制限）
        setChatHistory((prev) => {
          const nextHistory = [
            ...prev,
            { role: 'user', text },
            { role: 'model', text: geminiReply },
          ];
          if (nextHistory.length > 10) {
            return nextHistory.slice(nextHistory.length - 10);
          }
          return nextHistory;
        });
      }
    }

    // APIキーがない場合、またはGeminiの呼び出しが失敗した場合は定型文でフォールバック
    if (!reply) {
      setPetEmotion('happy');
      const textLower = text.toLowerCase();
      
      if (evolution === 'angel') {
        if (textLower.includes('こんにちは') || textLower.includes('おは') || textLower.includes('ハロー')) {
          reply = 'ごきげんよう！私のお手伝いが必要ですか？ふふっ👼';
        } else if (textLower.includes('可愛い') || textLower.includes('すき') || textLower.includes('好き')) {
          reply = '私もあなたのことがとっても愛おしいです！いつも見守っていますね❤️';
        } else {
          reply = 'あなたが話しかけてくれるだけで、心にぽっと明かりが灯るようです！';
        }
      } else if (evolution === 'devil') {
        if (textLower.includes('こんにちは') || textLower.includes('おは') || textLower.includes('ハロー')) {
          reply = 'ちっ、また話しかけてきたのか？…べ、別に嬉しくなんかないぞ！😈';
        } else if (textLower.includes('可愛い') || textLower.includes('すき') || textLower.includes('好き')) {
          reply = 'な、何言ってるんだよ！からかわないでよね！バカ！///❤️';
        } else {
          reply = 'ふん、暇つぶしに付き合ってやるよ。もっと面白いこと話しなさいよね！';
        }
      } else {
        if (textLower.includes('こんにちは') || textLower.includes('おは') || textLower.includes('ハロー')) {
          reply = AI_RESPONSES.greetings[Math.floor(Math.random() * AI_RESPONSES.greetings.length)];
        } else if (textLower.includes('可愛い') || textLower.includes('すき') || textLower.includes('好き')) {
          reply = 'えへへ、照れちゃうな！ぼくもあなたが大好き！❤️';
        } else {
          reply = AI_RESPONSES.default[Math.floor(Math.random() * AI_RESPONSES.default.length)];
        }
      }
    }

    // 吹き出しを起動
    setPetEmotion('happy');
    triggerBubble(formatReply(reply));
    
    setTimeout(() => {
      setPetEmotion('normal');
      setIsTyping(false); // ローディングオフ
    }, 2000);

    checkEvolution(actionCount, nextCareScore);
  };

  // --- トークン回復処理: 動画広告を見る ---
  const handleWatchAd = () => {
    setIsAdLoading(true);
    setPurchaseStatus('');
    setTimeout(() => {
      setIsAdLoading(false);
      setTokens(10);
      setNextRecoverySec(15);
      setIsModalVisible(false);
      triggerBubble(`ピピ！いっぱい眠って元気が戻ったよ！ありがとう！⚡`);
    }, 1500);
  };

  // --- トークン回復処理: 課金して回復 ---
  const handlePurchaseTokens = () => {
    setPurchaseStatus('購入処理中...');
    setTimeout(() => {
      setPurchaseStatus('購入が完了しました！');
      setTimeout(() => {
        setPurchaseStatus('');
        setTokens(10);
        setNextRecoverySec(15);
        setIsModalVisible(false);
        triggerBubble(`キュイーン！特別なパワーで満タンになったよ！✨`);
      }, 1000);
    }, 1200);
  };

  // --- あもれもんの色決定 ---
  const getPetColors = () => {
    if (evolution === 'angel') return ['#ffe066', '#fbc2eb'];
    if (evolution === 'devil') return ['#9400d3', '#ff007f'];
    
    switch (petEmotion) {
      case 'happy': return ['#ff758c', '#ff7eb3'];
      case 'sad': return ['#4facfe', '#00f2fe'];
      case 'eating': return ['#43e97b', '#38f9d7'];
      default: return ['#a18cd1', '#e0c3fc'];
    }
  };

  const petColors = getPetColors();

  const getFloatingStyle = () => {
    if (isWeb) return {};
    return {
      transform: [
        { translateY: Animated.add(floatAnim, bounceAnim) },
        { scaleX: scaleXAnim },
        { scaleY: scaleYAnim },
      ],
    };
  };

  return (
    <View style={styles.container}>
      <View style={styles.phoneFrame}>
        {/* 名前が決まっていない場合は「命名ウェルカム画面」を表示 */}
        {!isNamed ? (
          <View style={styles.namingContainer}>
            <View style={styles.namingHeader}>
              <Text style={styles.headerTitle}>AMOREMON</Text>
            </View>

            <View style={styles.namingPetArea}>
              <Animated.View
                style={[styles.petWrapper, getFloatingStyle()]}
                className={isWeb ? 'web-floating web-breathing' : ''}
              >
                <View style={styles.petShadow} />
                <View style={[styles.petBody, { backgroundColor: '#a18cd1', shadowColor: '#e0c3fc' }]}>
                  <View style={styles.face}>
                    <View style={styles.eyeRow}>
                      <View style={styles.eye}><View style={styles.pupil} /></View>
                      <View style={styles.eye}><View style={styles.pupil} /></View>
                    </View>
                    <Text style={styles.mouth}>◡</Text>
                  </View>
                  <View style={styles.cheekRow}>
                    <View style={styles.cheek} />
                    <View style={styles.cheek} />
                  </View>
                </View>
              </Animated.View>
            </View>

            <View style={styles.namingCard}>
              <Text style={styles.namingTitle}>あもれもんに名前をつけてね！</Text>
              <Text style={styles.namingSubtitle}>今日からあなたの大切なパートナーになります。</Text>
              
              <TextInput
                style={styles.namingInput}
                placeholder="名前を入力してください..."
                placeholderTextColor="#7f8c8d"
                value={nameInput}
                onChangeText={setNameInput}
                maxLength={10}
                onSubmitEditing={handleRegisterName}
              />
              
              <TouchableOpacity
                style={[styles.namingButton, !nameInput.trim() && styles.namingButtonDisabled]}
                onPress={handleRegisterName}
                disabled={!nameInput.trim()}
              >
                <Text style={styles.namingButtonText}>あもれもんを呼び出す ✨</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* 名前が決まっている場合は極小UIの「育成画面」を表示 */
          <>
            {/* ヘッダーエリア (名前のみ) */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{petName.toUpperCase()}</Text>
            </View>

            {/* メインあもれもん描画エリア */}
            <View style={styles.petCanvas}>
              {/* 吹き出し (Speech Bubble) */}
              {bubbleVisible && (
                <View style={styles.bubbleWrapper} className={isWeb ? 'web-bubble' : ''}>
                  <View style={styles.speechBubble}>
                    <Text style={styles.bubbleTextContent}>{bubbleText}</Text>
                    <View style={styles.bubbleArrow} />
                  </View>
                </View>
              )}

              <Animated.View
                style={[styles.petWrapper, getFloatingStyle()]}
                className={isWeb ? `web-floating web-breathing ${isBouncing ? 'web-bouncing' : ''}` : ''}
              >
                {/* エンジェル形態時の「天使の輪」 */}
                {evolution === 'angel' && (
                  <View style={styles.angelHalo} className={isWeb ? 'web-halo' : ''} />
                )}

                {/* デビル形態時の「ツノ」 */}
                {evolution === 'devil' && (
                  <View style={styles.devilHornsContainer} className={isWeb ? 'web-devil' : ''}>
                    <View style={[styles.devilHorn, styles.devilHornLeft]} />
                    <View style={[styles.devilHorn, styles.devilHornRight]} />
                  </View>
                )}

                {/* あもれもんの影 */}
                <View style={styles.petShadow} />

                {/* あもれもん本体 */}
                <View style={[styles.petBody, { backgroundColor: petColors[0], shadowColor: petColors[1] }]}>
                  <View style={styles.face}>
                    {petEmotion === 'normal' && (
                      <>
                        <View style={styles.eyeRow}>
                          <View style={styles.eye}><View style={styles.pupil} /></View>
                          <View style={styles.eye}><View style={styles.pupil} /></View>
                        </View>
                        <Text style={styles.mouth}>◡</Text>
                      </>
                    )}
                    {petEmotion === 'happy' && (
                      <>
                        <View style={styles.eyeRow}>
                          <Text style={styles.eyeEmoji}>^</Text>
                          <Text style={styles.eyeEmoji}>^</Text>
                        </View>
                        <Text style={styles.mouthHappy}>❤️</Text>
                      </>
                    )}
                    {petEmotion === 'sad' && (
                      <>
                        <View style={styles.eyeRow}>
                          <Text style={styles.eyeEmoji}>T</Text>
                          <Text style={styles.eyeEmoji}>T</Text>
                        </View>
                        <Text style={styles.mouth}>⌢</Text>
                      </>
                    )}
                    {petEmotion === 'eating' && (
                      <>
                        <View style={styles.eyeRow}>
                          <Text style={styles.eyeEmoji}>&gt;</Text>
                          <Text style={styles.eyeEmoji}>&lt;</Text>
                        </View>
                        <Text style={styles.mouthEating}>⬡</Text>
                      </>
                    )}
                  </View>

                  <View style={styles.cheekRow}>
                    <View style={styles.cheek} />
                    <View style={styles.cheek} />
                  </View>
                </View>
              </Animated.View>

              {/* パーティクルエフェクト */}
              {particles.map((p) => (
                <Animated.View
                  key={p.id}
                  style={[
                    styles.particle,
                    {
                      transform: [
                        { translateX: p.x },
                        { translateY: p.y },
                        { scale: p.scale },
                      ],
                      opacity: p.opacity,
                    },
                  ]}
                >
                  <Text style={styles.particleText}>{p.emoji}</Text>
                </Animated.View>
              ))}
            </View>

            {/* 観察空間 (完全に空白) */}
            <View style={styles.observationSpace} />

            {/* 入力・操作アクションエリア */}
            <View style={styles.inputArea}>
              {/* 1段目: チャット入力欄と送信ボタン */}
              <View style={styles.chatInputRow}>
                <TextInput
                  style={styles.textInput}
                  placeholder={`${petName}に話しかけてみよう...`}
                  placeholderTextColor="#7f8c8d"
                  value={inputText}
                  onChangeText={setInputText}
                  onSubmitEditing={handleSendMessage}
                />
                <TouchableOpacity 
                  style={[styles.sendButton, isTyping && styles.sendButtonDisabled]} 
                  onPress={handleSendMessage}
                  disabled={isTyping}
                >
                  {isTyping ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.sendButtonText}>送信</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* 2段目: お世話をするボタンを下に大きく配置 (見切れ防止・自動翻訳対策のnotranslate指定) */}
              <TouchableOpacity 
                style={styles.careMenuButton} 
                onPress={() => setIsMenuVisible(true)}
                className={isWeb ? 'notranslate' : ''}
              >
                <Text style={styles.careButtonText} className={isWeb ? 'notranslate' : ''}>{TRANSLATION_SAFE_TEXT.care} ✨</Text>
              </TouchableOpacity>
            </View>

            {/* お世話メニュー (ボトムシート風スライドアップ画面) */}
            {isMenuVisible && (
              <View style={styles.overlayContainer} className={isWeb ? 'web-fade-in' : ''}>
                <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={() => setIsMenuVisible(false)} />
                
                <View style={styles.bottomSheet} className={isWeb ? 'notranslate web-slide-up' : ''}>
                  <View style={styles.sheetHeader}>
                    <View style={styles.sheetHandle} />
                    <Text style={styles.sheetTitle} className={isWeb ? 'notranslate' : ''}>{petName}の{TRANSLATION_SAFE_TEXT.care}</Text>
                  </View>

                  <View style={styles.sheetButtonsContainer}>
                    <TouchableOpacity style={styles.sheetOptionButton} onPress={performFeed} className={isWeb ? 'notranslate' : ''}>
                      <Text style={styles.sheetOptionIcon}>🍖</Text>
                      <Text style={styles.sheetOptionLabel} className={isWeb ? 'notranslate' : ''}>{TRANSLATION_SAFE_TEXT.feed}</Text>
                      <Text style={styles.sheetOptionDesc} className={isWeb ? 'notranslate' : ''}>エネルギーが回復します</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.sheetOptionButton} onPress={performPlay} className={isWeb ? 'notranslate' : ''}>
                      <Text style={styles.sheetOptionIcon}>🪁</Text>
                      <Text style={styles.sheetOptionLabel} className={isWeb ? 'notranslate' : ''}>{TRANSLATION_SAFE_TEXT.play}</Text>
                      <Text style={styles.sheetOptionDesc} className={isWeb ? 'notranslate' : ''}>なつき度が上昇します</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.sheetOptionButton} onPress={performGift} className={isWeb ? 'notranslate' : ''}>
                      <Text style={styles.sheetOptionIcon}>🎁</Text>
                      <Text style={styles.sheetOptionLabel} className={isWeb ? 'notranslate' : ''}>{TRANSLATION_SAFE_TEXT.gift}</Text>
                      <Text style={styles.sheetOptionDesc} className={isWeb ? 'notranslate' : ''}>なつき度が大幅に上昇します</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity style={styles.sheetCloseButton} onPress={() => setIsMenuVisible(false)} className={isWeb ? 'notranslate' : ''}>
                    <Text style={styles.sheetCloseText} className={isWeb ? 'notranslate' : ''}>{TRANSLATION_SAFE_TEXT.cancel}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 回復ポップアップ (トークン不足時のモーダル画面) */}
            {isModalVisible && (
              <View style={styles.overlayContainer} className={isWeb ? 'web-fade-in' : ''}>
                <View style={styles.overlayBg} />
                
                <View style={styles.modalCard} className={isWeb ? 'notranslate' : ''}>
                  {isAdLoading ? (
                    <View style={styles.modalLoadingArea} className={isWeb ? 'notranslate' : ''}>
                      <ActivityIndicator size="large" color="#ff007f" />
                      <Text style={styles.modalLoadingText} className={isWeb ? 'notranslate' : ''}>{petName}の夢を読み込み中... 💤</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.modalTitle} className={isWeb ? 'notranslate' : ''}>{petName}がおねむです 😴</Text>
                      <Text style={styles.modalSubtitle} className={isWeb ? 'notranslate' : ''}>
                        アクションを起こすエネルギー（トークン）が空っぽになってしまいました。
                        ゆっくり休ませてあげるか、回復してあげましょう。
                      </Text>

                      {purchaseStatus ? (
                        <Text style={styles.purchaseStatusText} className={isWeb ? 'notranslate' : ''}>{purchaseStatus}</Text>
                      ) : null}

                      <TouchableOpacity style={styles.modalOptionButton} onPress={handleWatchAd} className={isWeb ? 'notranslate' : ''}>
                        <Text style={styles.modalOptionText} className={isWeb ? 'notranslate' : ''}>📽️ 動画を見て全回復（無料）</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={[styles.modalOptionButton, styles.modalPayButton]} onPress={handlePurchaseTokens} className={isWeb ? 'notranslate' : ''}>
                        <Text style={styles.modalOptionText} className={isWeb ? 'notranslate' : ''}>🪙 120円で即時全回復</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.modalCloseButton} onPress={() => setIsModalVisible(false)} className={isWeb ? 'notranslate' : ''}>
                        <Text style={styles.modalCloseText} className={isWeb ? 'notranslate' : ''}>閉じる</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            )}
          </>
        )}
      </View>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Platform.OS === 'web' ? 40 : 0,
  },
  phoneFrame: {
    width: Platform.OS === 'web' ? 412 : '100%',
    height: Platform.OS === 'web' ? 846 : '100%',
    backgroundColor: '#0a0f1d',
    borderRadius: Platform.OS === 'web' ? 36 : 0,
    borderWidth: Platform.OS === 'web' ? 12 : 0,
    borderColor: '#1e293b',
    overflow: 'hidden',
    shadowColor: '#ff007f',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: Platform.OS === 'web' ? 0.3 : 0,
    shadowRadius: 20,
    elevation: 5,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  // 命名画面
  namingContainer: {
    flex: 1,
    backgroundColor: '#0a0f2d',
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  namingHeader: {
    paddingTop: Platform.OS === 'ios' ? 60 : 36,
    alignItems: 'center',
  },
  namingPetArea: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  namingCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 127, 0.25)',
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 20,
    backdropFilter: 'blur(10px)',
  },
  namingTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  namingSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  namingInput: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    paddingHorizontal: 16,
    color: '#fff',
    fontSize: 15,
    height: 48,
    borderWidth: 1,
    borderColor: '#374151',
    textAlign: 'center',
    marginBottom: 16,
  },
  namingButton: {
    backgroundColor: '#ff007f',
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  namingButtonDisabled: {
    backgroundColor: '#475569',
  },
  namingButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  // 育成画面
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 24,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#ff007f',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 2.0,
    textShadowColor: 'rgba(255, 0, 127, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  petCanvas: {
    height: 380,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: '#0a0f2d',
    paddingTop: 45,
  },
  bubbleWrapper: {
    position: 'absolute',
    top: 30,
    zIndex: 10,
    width: '85%',
    alignItems: 'center',
  },
  speechBubble: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 127, 0.3)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'relative',
    shadowColor: '#ff007f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
    backdropFilter: 'blur(5px)',
  },
  bubbleTextContent: {
    color: '#f8fafc',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  bubbleArrow: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    marginLeft: -8,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderLeftColor: 'transparent',
    borderRightWidth: 8,
    borderRightColor: 'transparent',
    borderTopWidth: 8,
    borderTopColor: 'rgba(30, 41, 59, 0.9)',
  },
  petWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 140,
    height: 140,
  },
  angelHalo: {
    position: 'absolute',
    top: -20,
    width: 60,
    height: 15,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#ffd700',
    backgroundColor: 'transparent',
    transform: [{ rotateX: '60deg' }],
    zIndex: 2,
    opacity: 0.9,
  },
  devilHornsContainer: {
    position: 'absolute',
    top: -5,
    width: 70,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  devilHorn: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderLeftColor: 'transparent',
    borderRightWidth: 8,
    borderRightColor: 'transparent',
    borderBottomWidth: 16,
    borderBottomColor: '#ff0055',
  },
  devilHornLeft: {
    transform: [{ rotate: '-25deg' }],
  },
  devilHornRight: {
    transform: [{ rotate: '25deg' }],
  },
  petBody: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
  },
  petShadow: {
    position: 'absolute',
    bottom: -15,
    width: 80,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  face: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  eyeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 50,
    marginBottom: 6,
  },
  eye: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pupil: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#000',
  },
  eyeEmoji: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    lineHeight: 22,
  },
  mouth: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: -4,
  },
  mouthHappy: {
    fontSize: 16,
    marginTop: -2,
  },
  mouthEating: {
    color: '#fff',
    fontSize: 16,
    marginTop: -2,
  },
  cheekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 70,
    position: 'absolute',
    bottom: 30,
  },
  cheek: {
    width: 10,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 50, 120, 0.4)',
  },
  observationSpace: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  inputArea: {
    padding: 16,
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderRadius: 20,
    paddingHorizontal: 16,
    color: '#fff',
    fontSize: 14,
    height: 40,
    borderWidth: 1,
    borderColor: '#374151',
  },
  sendButton: {
    backgroundColor: '#2563eb',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    height: 40,
    paddingHorizontal: 18,
    marginLeft: 8,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  careMenuButton: {
    backgroundColor: '#ff007f',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    height: 40,
    marginTop: 12,
    width: '100%',
    shadowColor: '#ff007f',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  careButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  // オーバーレイ共通
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    justifyContent: 'flex-end',
  },
  overlayBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  // お世話メニュー（ボトムシート）
  bottomSheet: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 0, 127, 0.25)',
    shadowColor: '#ff007f',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
  },
  sheetHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#374151',
    marginBottom: 12,
  },
  sheetTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sheetButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  sheetOptionButton: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sheetOptionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  sheetOptionLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sheetOptionDesc: {
    color: '#94a3b8',
    fontSize: 9,
    textAlign: 'center',
  },
  sheetCloseButton: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetCloseText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // 回復ポップアップ（モーダル）
  modalCard: {
    position: 'absolute',
    top: '30%',
    left: 20,
    right: 20,
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 127, 0.3)',
    alignItems: 'center',
    shadowColor: '#ff007f',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  modalOptionButton: {
    backgroundColor: '#ff007f',
    borderRadius: 16,
    height: 48,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#ff007f',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  modalPayButton: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
  },
  modalOptionText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  modalCloseButton: {
    marginTop: 8,
  },
  modalCloseText: {
    color: '#64748b',
    fontSize: 13,
  },
  modalLoadingArea: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  modalLoadingText: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 16,
  },
  purchaseStatusText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  particle: {
    position: 'absolute',
    zIndex: 10,
  },
  particleText: {
    fontSize: 28,
  },
  sendButtonDisabled: {
    backgroundColor: '#1d4ed8',
    opacity: 0.7,
  },
});
