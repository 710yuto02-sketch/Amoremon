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
} from 'react-native';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

// 簡易AI応答データベース（キーワード対応＆ランダム返答）
const AI_RESPONSES = {
  greetings: ['ピピ！こんにちは！今日もよろしくね！', 'ピュイ！起きてたよ！お話ししよう！', 'クーン、なでなでして〜！'],
  foods: ['モグモグ…！おいしい！あもーれ！', 'パクパク！これ大好きなんだ！', 'ピピ！お腹いっぱいになってきた！'],
  happy: ['ウキウキするなぁ！', 'あなたといると、とっても幸せ！', 'ピュイピュイ！ダンスしちゃう！'],
  sad: ['ちょっと寂しいな…', 'お腹がすくと力が出ないよぅ', 'ピピ…もっとかまってほしいな'],
  default: [
    'ピピ！その言葉、覚えておくね！',
    'ふむふむ、もっと教えて！',
    'あなたの声、とっても優しくて好きだな！',
    'ピュイ！明日は晴れるかな？',
  ],
};

// Web用のCSSアニメーション定義 (ブラウザの負荷をほぼゼロにして滑らかに動かします)
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
`;

// Web環境の場合のみ、マウント前に一度だけドキュメントのheadにスタイルを注入
if (isWeb && typeof document !== 'undefined') {
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

  const [hunger, setHunger] = useState(80); // お腹すき度 (0 - 100, 100が満腹)
  const [affection, setAffection] = useState(50); // なつき度 (0 - 100, 非表示)
  const [tokens, setTokens] = useState(8); // 行動権トークン (最大10)
  const [nextRecoverySec, setNextRecoverySec] = useState(15); // トークン回復までの時間 (秒)
  const [inputText, setInputText] = useState(''); // チャット入力
  
  // 吹き出しの状態
  const [bubbleText, setBubbleText] = useState('');
  const [bubbleVisible, setBubbleVisible] = useState(false);
  
  // 進化状態
  const [evolution, setEvolution] = useState('normal'); // normal, angel, devil
  const [actionCount, setActionCount] = useState(0); // 進化のためのアクション回数カウンター

  const [petEmotion, setPetEmotion] = useState('normal'); // 感情: normal, happy, sad, eating
  const [careScore, setCareScore] = useState(50); // お世話スコア
  const [isBouncing, setIsBouncing] = useState(false); // エサやりのバウンド状態 (Web用)

  // --- アニメーション参照 (スマートフォンアプリ専用) ---
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleXAnim = useRef(new Animated.Value(1)).current;
  const scaleYAnim = useRef(new Animated.Value(1)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  
  // 吹き出し消去タイマーの参照
  const bubbleTimerRef = useRef(null);

  // --- タイマーとアニメーションのセットアップ ---
  useEffect(() => {
    if (isWeb) return;

    // 1. 浮遊と呼吸アニメーション (スマホアプリ用)
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -15,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleXAnim, {
            toValue: 1.05,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scaleYAnim, {
            toValue: 0.95,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scaleXAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scaleYAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();

    return () => {
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    };
  }, []);

  // 2. トークン自動回復タイマー (tokensが10未満の時のみ毎秒カウントダウン)
  useEffect(() => {
    if (!isNamed) return; // 命名されるまではタイマーを走らせない
    if (tokens >= 10) {
      setNextRecoverySec(15);
      return;
    }

    const timer = setInterval(() => {
      setNextRecoverySec((prevSec) => {
        if (prevSec <= 1) {
          setTokens((t) => Math.min(10, t + 1));
          return 15; // 15秒にリセット
        }
        return prevSec - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [tokens, isNamed]);

  // 3. お腹が徐々に空くタイマー (25秒ごとにお腹度-5)
  useEffect(() => {
    if (!isNamed) return; // 命名されるまではお腹は減らない
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

  // --- 吹き出し表示＆自動消去ロジック (6秒) ---
  const triggerBubble = (text) => {
    // 既存のタイマーをクリア
    if (bubbleTimerRef.current) {
      clearTimeout(bubbleTimerRef.current);
    }
    setBubbleText(text);
    setBubbleVisible(true);
    bubbleTimerRef.current = setTimeout(() => {
      setBubbleVisible(false);
    }, 6000); // 6秒間表示
  };

  // --- セリフ内の名前自動置換 ---
  const formatReply = (text) => {
    return text.replace(/あもれもん/g, petName || 'あもれもん');
  };

  // --- アクションカウンターと進化チェック (合計5回アクションで進化) ---
  const checkEvolution = (currentActionCount, currentCareScore) => {
    if (evolution !== 'normal') return; // すでに進化している場合はスキップ

    const nextCount = currentActionCount + 1;
    setActionCount(nextCount);

    if (nextCount >= 5) {
      // 5回目のアクションで進化決定
      setTimeout(() => {
        if (currentCareScore >= 55) {
          setEvolution('angel');
          triggerBubble(`ピピ…！なんだか体がキラキラ光るよ…！【エンジェル${petName}】に進化した！👼`);
        } else {
          setEvolution('devil');
          triggerBubble(`ピピピッ！背中がムズムズする…！【デビル${petName}】に進化した！😈`);
        }
        setPetEmotion('happy');
        // 進化したらステータスを少し回復
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

    // 決定時のバウンド演出
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

    // 命名完了の吹き出しをポップアップ
    setTimeout(() => {
      triggerBubble(`ピピ！今日からぼくの名前は「${name}」だね！いっぱいお世話してね！❤️`);
    }, 200);
  };

  // --- アクション処理: エサをあげる ---
  const handleFeed = () => {
    if (tokens <= 0) {
      triggerBubble('⚡ トークンが足りないよぅ。少し待つか、広告を見て回復してね！');
      return;
    }

    setTokens((prev) => prev - 1);
    setHunger((prev) => Math.min(100, prev + 25));
    
    // なつき度とお世話スコアの更新 (画面には表示されない隠し要素)
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

    const foodReplies = AI_RESPONSES.foods;
    const reply = foodReplies[Math.floor(Math.random() * foodReplies.length)];
    triggerBubble(formatReply(reply));

    // 進化チェック
    checkEvolution(actionCount, nextCareScore);
  };

  // --- アクション処理: 会話する (送信) ---
  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    if (tokens <= 0) {
      triggerBubble('⚡ トークンが足りないよぅ。');
      return;
    }

    const text = inputText;
    setInputText('');
    setTokens((prev) => prev - 1);

    // 会話によるなつき度とスコアの更新
    setAffection((prev) => Math.min(100, prev + 12));
    const nextCareScore = Math.min(100, careScore + 3);
    setCareScore(nextCareScore);

    // あもれもんの応答生成
    setTimeout(() => {
      setPetEmotion('happy');

      let reply = '';
      const textLower = text.toLowerCase();
      
      // 進化状態に応じたセリフの分岐
      if (evolution === 'angel') {
        if (textLower.includes('こんにちは') || textLower.includes('おは') || textLower.includes('ハロー')) {
          reply = 'ごきげんよう！私のお手伝いが必要ですか？ふふっ👼';
        } else if (textLower.includes('お腹') || textLower.includes('ごはん') || textLower.includes('エサ')) {
          reply = `お腹の具合は【${hunger}%】です。美味しいフルーツが食べたいですわ🍎`;
        } else if (textLower.includes('可愛い') || textLower.includes('すき') || textLower.includes('好き')) {
          reply = '私もあなたのことがとっても愛おしいです！いつも見守っていますね❤️';
        } else {
          reply = 'あなたが話しかけてくれるだけで、心にぽっと明かりが灯るようです！';
        }
      } else if (evolution === 'devil') {
        if (textLower.includes('こんにちは') || textLower.includes('おは') || textLower.includes('ハロー')) {
          reply = 'ちっ、また話しかけてきたのか？…べ、別に嬉しくなんかないぞ！😈';
        } else if (textLower.includes('お腹') || textLower.includes('ごはん') || textLower.includes('エサ')) {
          reply = `お腹？【${hunger}%】だけど。早くうまいもん寄越しなさいよ！`;
        } else if (textLower.includes('可愛い') || textLower.includes('すき') || textLower.includes('好き')) {
          reply = 'な、何言ってるんだよ！からかわないでよね！バカ！///❤️';
        } else {
          reply = 'ふん、暇つぶしに付き合ってやるよ。もっと面白いこと話しなさいよね！';
        }
      } else {
        // ノーマル形態のセリフ
        if (textLower.includes('こんにちは') || textLower.includes('おは') || textLower.includes('ハロー')) {
          reply = AI_RESPONSES.greetings[Math.floor(Math.random() * AI_RESPONSES.greetings.length)];
        } else if (textLower.includes('お腹') || textLower.includes('ごはん') || textLower.includes('エサ')) {
          reply = `ピピ！今のお腹すき具合は【${hunger}%】だよ！${hunger < 50 ? 'お腹すいたなぁ〜' : 'まだ大丈夫！'}`;
        } else if (textLower.includes('可愛い') || textLower.includes('すき') || textLower.includes('好き')) {
          reply = 'えへへ、照れちゃうな！ぼくもあなたが大好き！❤️';
        } else {
          reply = AI_RESPONSES.default[Math.floor(Math.random() * AI_RESPONSES.default.length)];
        }
      }

      triggerBubble(formatReply(reply));
      
      setTimeout(() => setPetEmotion('normal'), 2500);
    }, 600);

    // 進化チェック
    checkEvolution(actionCount, nextCareScore);
  };

  // --- トークン即時回復 ---
  const handleRecoverTokens = () => {
    setTokens(10);
    setNextRecoverySec(15);
    triggerBubble('⚡ 広告を見てくれてありがとう！トークンが満タンになったよ！');
  };

  // --- ペットの色・グラデーション決定 ---
  const getPetColors = () => {
    if (evolution === 'angel') {
      return ['#ffe066', '#fbc2eb']; // 天使のゴールド＆ピンク
    }
    if (evolution === 'devil') {
      return ['#9400d3', '#ff007f']; // 悪魔のディープバイオレット＆ホットピンク
    }
    
    // 通常時の感情による色変化
    switch (petEmotion) {
      case 'happy':
        return ['#ff758c', '#ff7eb3']; // 嬉しくてピンク
      case 'sad':
        return ['#4facfe', '#00f2fe']; // 寂しくてブルー
      case 'eating':
        return ['#43e97b', '#38f9d7']; // 元気なグリーン
      default:
        return ['#a18cd1', '#e0c3fc']; // 通常のディープパープル
    }
  };

  const petColors = getPetColors();

  // --- Web用とスマホ用のスタイル・クラス決定 ---
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
            {/* ヘッダー風の飾り */}
            <View style={styles.namingHeader}>
              <Text style={styles.headerTitle}>AMOREMON</Text>
            </View>

            {/* 中央のあもれもん（ベイビー形態） */}
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

            {/* 命名フォームカード */}
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
                style={[
                  styles.namingButton,
                  !nameInput.trim() && styles.namingButtonDisabled
                ]}
                onPress={handleRegisterName}
                disabled={!nameInput.trim()}
              >
                <Text style={styles.namingButtonText}>あもれもんを呼び出す ✨</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* 名前が決まっている場合は通常の「育成画面」を表示 */
          <>
            {/* ヘッダーエリア */}
            <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>{petName.toUpperCase()}</Text>
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>
                    {evolution === 'normal' ? 'ベイビー期' : evolution === 'angel' ? 'エンジェル期 👼' : 'デビル期 😈'}
                  </Text>
                </View>
              </View>
              <View style={styles.tokenContainer}>
                <Text style={styles.tokenLabel}>⚡ {tokens}/10</Text>
                {tokens < 10 && (
                  <Text style={styles.timerText}>+{nextRecoverySec}s</Text>
                )}
              </View>
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
                style={[
                  styles.petWrapper,
                  getFloatingStyle(),
                ]}
                className={
                  isWeb
                    ? `web-floating web-breathing ${isBouncing ? 'web-bouncing' : ''}`
                    : ''
                }
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
                <View
                  style={[
                    styles.petBody,
                    {
                      backgroundColor: petColors[0],
                      shadowColor: petColors[1],
                    },
                  ]}
                >
                  {/* あもれもんの表情 */}
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

                  {/* チーク(頬紅) */}
                  <View style={styles.cheekRow}>
                    <View style={styles.cheek} />
                    <View style={styles.cheek} />
                  </View>
                </View>
              </Animated.View>
            </View>

            {/* ステータスバーエリア */}
            <View style={styles.statusSection}>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>🍖 エネルギー</Text>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${hunger}%`,
                        backgroundColor: hunger < 30 ? '#ff4d4d' : '#00e676',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.statusVal}>{hunger}%</Text>
              </View>
            </View>

            {/* 中央の広々とした観察空間 */}
            <View style={styles.observationArea}>
              <Text style={styles.observationHint}>
                {evolution === 'normal'
                  ? `お世話をすると、${petName}が進化するよ。どんな姿になるかな？`
                  : `${petName}のお世話を続けよう。会話の内容が変化しているよ。`}
              </Text>
            </View>

            {/* 入力・操作アクションエリア */}
            <View style={styles.inputArea}>
              <View style={styles.chatInputRow}>
                <TextInput
                  style={styles.textInput}
                  placeholder={`${petName}に話しかけてみよう...`}
                  placeholderTextColor="#7f8c8d"
                  value={inputText}
                  onChangeText={setInputText}
                  onSubmitEditing={handleSendMessage}
                />
                <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
                  <Text style={styles.sendButtonText}>送信</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionButton} onPress={handleFeed}>
                  <Text style={styles.actionIcon}>🍖</Text>
                  <Text style={styles.actionLabel}>エサやり</Text>
                  <Text style={styles.actionCost}>⚡1消費</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.recoveryButton]}
                  onPress={handleRecoverTokens}
                >
                  <Text style={styles.actionIcon}>⚡</Text>
                  <Text style={styles.actionLabel}>広告で回復</Text>
                  <Text style={styles.actionCost}>全回復</Text>
                </TouchableOpacity>
              </View>
            </View>
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
  },
  // 命名画面のスタイル
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
    shadowColor: '#ff007f',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
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
    shadowColor: '#ff007f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  namingButtonDisabled: {
    backgroundColor: '#475569',
    shadowOpacity: 0,
  },
  namingButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  // 育成画面のスタイル
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 24,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#ff007f',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(255, 0, 127, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  badgeContainer: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#a1a1aa',
    fontSize: 11,
    fontWeight: '600',
  },
  tokenContainer: {
    alignItems: 'flex-end',
  },
  tokenLabel: {
    color: '#ffdf00',
    fontSize: 16,
    fontWeight: 'bold',
    textShadowColor: 'rgba(255, 223, 0, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  timerText: {
    color: '#9ca3af',
    fontSize: 10,
    marginTop: 2,
  },
  petCanvas: {
    height: 330,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: '#0a0f2d',
    paddingTop: 40,
  },
  bubbleWrapper: {
    position: 'absolute',
    top: 25,
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
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
  statusSection: {
    padding: 16,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    color: '#e5e7eb',
    fontSize: 12,
    width: 90,
    fontWeight: '600',
  },
  progressBarBg: {
    flex: 1,
    height: 10,
    backgroundColor: '#374151',
    borderRadius: 5,
    overflow: 'hidden',
    marginHorizontal: 10,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  statusVal: {
    color: '#9ca3af',
    fontSize: 12,
    width: 32,
    textAlign: 'right',
  },
  observationArea: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  observationHint: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  inputArea: {
    padding: 16,
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  chatInputRow: {
    flexDirection: 'row',
    marginBottom: 12,
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
    paddingHorizontal: 18,
    marginLeft: 8,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  recoveryButton: {
    borderColor: '#4d7c0f',
    backgroundColor: '#14532d',
  },
  actionIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  actionLabel: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: 'bold',
  },
  actionCost: {
    color: '#94a3b8',
    fontSize: 9,
    marginTop: 2,
  },
});
