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
  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    if (tokens <= 0) {
      setIsModalVisible(true);
      return;
    }

    const text = inputText;
    setInputText('');
    setTokens((prev) => prev - 1);

    setAffection((prev) => Math.min(100, prev + 8));
    const nextCareScore = Math.min(100, careScore + 2);
    setCareScore(nextCareScore);

    setTimeout(() => {
      setPetEmotion('happy');

      let reply = '';
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

      triggerBubble(formatReply(reply));
      setTimeout(() => setPetEmotion('normal'), 2500);
    }, 600);

    checkEvolution(actionCount, nextCareScore);
  };

  // --- トークン回復処理: 動画広告を見る ---
  const handleWatchAd = () => {
    setIsAdLoading(true);
    setPurchaseStatus('');
    // 1.5秒のローディング（広告読み込みシミュレーション）
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
            </View>

            {/* 観察空間 (完全に空白。あもれもんの美しさを際立たせる) */}
            <View style={styles.observationSpace} />

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

                <TouchableOpacity style={styles.careMenuButton} onPress={() => setIsMenuVisible(true)}>
                  <Text style={styles.careButtonText}>お世話 ✨</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* お世話メニュー (ボトムシート風スライドアップ画面) */}
            {isMenuVisible && (
              <View style={styles.overlayContainer} className={isWeb ? 'web-fade-in' : ''}>
                {/* 背景タップで閉じる */}
                <TouchableOpacity style={styles.overlayBg} activeOpacity={1} onPress={() => setIsMenuVisible(false)} />
                
                <View style={styles.bottomSheet} className={isWeb ? 'web-slide-up' : ''}>
                  <View style={styles.sheetHeader}>
                    <View style={styles.sheetHandle} />
                    <Text style={styles.sheetTitle}>{petName}のお世話をする</Text>
                  </View>

                  <View style={styles.sheetButtonsContainer}>
                    <TouchableOpacity style={styles.sheetOptionButton} onPress={performFeed}>
                      <Text style={styles.sheetOptionIcon}>🍖</Text>
                      <Text style={styles.sheetOptionLabel}>お食事</Text>
                      <Text style={styles.sheetOptionDesc}>エネルギーが回復します</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.sheetOptionButton} onPress={performPlay}>
                      <Text style={styles.sheetOptionIcon}>🪁</Text>
                      <Text style={styles.sheetOptionLabel}>遊ぶ</Text>
                      <Text style={styles.sheetOptionDesc}>なつき度が上昇します</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.sheetOptionButton} onPress={performGift}>
                      <Text style={styles.sheetOptionIcon}>🎁</Text>
                      <Text style={styles.sheetOptionLabel}>プレゼント</Text>
                      <Text style={styles.sheetOptionDesc}>なつき度が大幅に上昇します</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity style={styles.sheetCloseButton} onPress={() => setIsMenuVisible(false)}>
                    <Text style={styles.sheetCloseText}>キャンセル</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 回復ポップアップ (トークン不足時のモーダル画面) */}
            {isModalVisible && (
              <View style={styles.overlayContainer} className={isWeb ? 'web-fade-in' : ''}>
                <View style={styles.overlayBg} />
                
                <View style={styles.modalCard}>
                  {isAdLoading ? (
                    /* 動画ロード中の表示 */
                    <View style={styles.modalLoadingArea}>
                      <ActivityIndicator size="large" color="#ff007f" />
                      <Text style={styles.modalLoadingText}>あもれもんの夢を読み込み中... 💤</Text>
                    </View>
                  ) : (
                    /* 通常の回復選択肢 */
                    <>
                      <Text style={styles.modalTitle}>{petName}がおねむです 😴</Text>
                      <Text style={styles.modalSubtitle}>
                        アクションを起こすエネルギー（トークン）が空っぽになってしまいました。
                        ゆっくり休ませてあげるか、回復してあげましょう。
                      </Text>

                      {purchaseStatus ? (
                        <Text style={styles.purchaseStatusText}>{purchaseStatus}</Text>
                      ) : null}

                      <TouchableOpacity style={styles.modalOptionButton} onPress={handleWatchAd}>
                        <Text style={styles.modalOptionText}>📽️ 動画を見て全回復（無料）</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={[styles.modalOptionButton, styles.modalPayButton]} onPress={handlePurchaseTokens}>
                        <Text style={styles.modalOptionText}>🪙 120円で即時全回復</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.modalCloseButton} onPress={() => setIsModalVisible(false)}>
                        <Text style={styles.modalCloseText}>閉じる</Text>
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
    paddingHorizontal: 18,
    marginLeft: 8,
    shadowColor: '#ff007f',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  careButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
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
});
