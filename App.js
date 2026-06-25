import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

// 簡易AI応答データベース（キーワード対応＆ランダム返答）
const AI_RESPONSES = {
  greetings: ['ピピ！こんにちは！今日もよろしくね！', 'ピュイ！起きてたよ！お話ししよう！', 'クーン、なでなでして〜！'],
  foods: ['モグモグ…！おいしい！ありがとう！', 'パクパク！これ大好きなんだ！', 'ピピ！お腹いっぱいになってきた！'],
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
  .web-floating {
    animation: float 4s ease-in-out infinite;
  }
  .web-breathing {
    animation: breath 4s ease-in-out infinite;
  }
  .web-bouncing {
    animation: bounce 0.8s ease-in-out;
  }
`;

// Web環境の場合のみ、マウント前に一度だけドキュメントのheadにスタイルを注入
// これにより、Reactのコンポーネントツリーを汚さず、毎秒の再マウントによるフリーズを防ぎます。
if (isWeb && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.type = 'text/css';
  style.textContent = webStyles;
  document.head.appendChild(style);
}

export default function App() {
  // --- 状態管理 ---
  const [hunger, setHunger] = useState(80); // お腹すき度 (0 - 100, 100が満腹)
  const [affection, setAffection] = useState(50); // なつき度 (0 - 100)
  const [tokens, setTokens] = useState(8); // 行動権トークン (最大10)
  const [nextRecoverySec, setNextRecoverySec] = useState(15); // トークン回復までの時間 (秒)
  const [inputText, setInputText] = useState(''); // チャット入力
  const [messages, setMessages] = useState([
    { id: 1, sender: 'pet', text: 'ピピ！ぼくは「あもれもん」！これからよろしくね！', time: '15:00' }
  ]);
  const [petEmotion, setPetEmotion] = useState('normal'); // 感情: normal, happy, sad, eating, sleeping
  const [personality, setPersonality] = useState('すなお'); // 性格
  const [careScore, setCareScore] = useState(50); // お世話スコア
  const [isBouncing, setIsBouncing] = useState(false); // エサやりのバウンド状態 (Web用)

  // --- アニメーション参照 (スマートフォンアプリ専用) ---
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleXAnim = useRef(new Animated.Value(1)).current;
  const scaleYAnim = useRef(new Animated.Value(1)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const chatScrollRef = useRef();

  // --- タイマーとアニメーションのセットアップ ---
  useEffect(() => {
    // スマートフォン（iOS/Android）の時だけ、ネイティブのGPUアクセラレーションを有効にしたアニメーションを起動
    if (isWeb) return;

    // 1. 浮遊と呼吸アニメーション (スマホアプリで超滑らかに動く設定)
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
  }, []);

  // 2. トークン自動回復タイマー (tokensが10未満の時のみ毎秒カウントダウン)
  useEffect(() => {
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
  }, [tokens]);

  // 3. お腹が徐々に空くタイマー (20秒ごとにお腹度-5)
  useEffect(() => {
    const hungerInterval = setInterval(() => {
      setHunger((prev) => Math.max(0, prev - 5));
    }, 20000);

    return () => clearInterval(hungerInterval);
  }, []);

  // --- ペットの表情・色の判定 ---
  useEffect(() => {
    if (petEmotion === 'eating' || petEmotion === 'sleeping') return;

    if (hunger < 30) {
      setPetEmotion('sad');
    } else if (affection > 80) {
      setPetEmotion('happy');
    } else {
      setPetEmotion('normal');
    }
  }, [hunger, affection, petEmotion]);

  // --- スクロール追従 ---
  useEffect(() => {
    if (chatScrollRef.current) {
      setTimeout(() => {
        chatScrollRef.current.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // --- アクション処理: エサをあげる ---
  const handleFeed = () => {
    if (tokens <= 0) {
      addSystemMessage('⚡ トークンが足りません！時間回復を待つか、広告を見て回復してください。');
      return;
    }

    setTokens((prev) => prev - 1);
    setHunger((prev) => Math.min(100, prev + 25));
    setCareScore((prev) => Math.min(100, prev + 5));
    setPetEmotion('eating');

    if (isWeb) {
      // Web用のバウンドクラス起動
      setIsBouncing(true);
      setTimeout(() => {
        setIsBouncing(false);
        setPetEmotion('happy');
        setTimeout(() => setPetEmotion('normal'), 2000);
      }, 800);
    } else {
      // スマホアプリ用のバウンドアニメーション (GPU駆動)
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
    addPetMessage(reply);

    updatePersonality(25, 0);
  };

  // --- アクション処理: 会話する (送信) ---
  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    if (tokens <= 0) {
      addSystemMessage('⚡ トークンが足りません！');
      return;
    }

    const text = inputText;
    setInputText('');
    setTokens((prev) => prev - 1);
    addUserMessage(text);

    // 返答生成ロジック
    setTimeout(() => {
      setPetEmotion('happy');
      setAffection((prev) => Math.min(100, prev + 15));
      setCareScore((prev) => Math.min(100, prev + 3));

      let reply = '';
      const textLower = text.toLowerCase();
      if (textLower.includes('こんにちは') || textLower.includes('おは') || textLower.includes('ハロー')) {
        reply = AI_RESPONSES.greetings[Math.floor(Math.random() * AI_RESPONSES.greetings.length)];
      } else if (textLower.includes('お腹') || textLower.includes('ごはん') || textLower.includes('エサ')) {
        reply = `ピピ！今のお腹すき具合は【${hunger}%】だよ！${hunger < 50 ? 'お腹すいたなぁ〜' : 'まだ大丈夫！'}`;
      } else if (textLower.includes('可愛い') || textLower.includes('すき') || textLower.includes('好き')) {
        reply = 'えへへ、照れちゃうな！ぼくもあなたが大好き！❤️';
      } else {
        reply = AI_RESPONSES.default[Math.floor(Math.random() * AI_RESPONSES.default.length)];
      }

      addPetMessage(reply);
      updatePersonality(0, 15);
      
      setTimeout(() => setPetEmotion('normal'), 2500);
    }, 800);
  };

  // --- トークン即時回復 ---
  const handleRecoverTokens = () => {
    setTokens(10);
    setNextRecoverySec(15);
    addSystemMessage('⚡ 広告の視聴が完了し、トークンが全回復しました！');
  };

  // --- 性格決定ロジック (簡易ベクトル進化) ---
  const updatePersonality = (foodBoost, talkBoost) => {
    setCareScore((prevScore) => {
      const nextScore = prevScore + (foodBoost + talkBoost) / 10;
      // スコアに基づいて性格が進化
      if (nextScore > 75) {
        setPersonality('あまえんぼう');
      } else if (nextScore > 55) {
        setPersonality('おっとり');
      } else if (nextScore < 30) {
        setPersonality('ツンデレ');
      } else {
        setPersonality('すなお');
      }
      return Math.min(100, Math.max(0, nextScore));
    });
  };

  // --- メッセージ追加ユーティリティ ---
  const getCurrentTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  const addUserMessage = (text) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), sender: 'user', text, time: getCurrentTime() },
    ]);
  };

  const addPetMessage = (text) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now() + 1, sender: 'pet', text, time: getCurrentTime() },
    ]);
  };

  const addSystemMessage = (text) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now() + 2, sender: 'system', text, time: getCurrentTime() },
    ]);
  };

  // --- ペットの色決定 ---
  const getPetColors = () => {
    switch (petEmotion) {
      case 'happy':
        return ['#ff758c', '#ff7eb3']; // 愛らしいピンク
      case 'sad':
        return ['#4facfe', '#00f2fe']; // 寂しいブルー
      case 'eating':
        return ['#43e97b', '#38f9d7']; // 元気なグリーン
      default:
        return ['#a18cd1', '#fbc2eb']; // 通常のディープパープル・ピンク
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
        {/* ヘッダーエリア */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>AMOREMON</Text>
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>性格: {personality}</Text>
            </View>
          </View>
          <View style={styles.tokenContainer}>
            <Text style={styles.tokenLabel}>⚡ {tokens}/10</Text>
            {tokens < 10 && (
              <Text style={styles.timerText}>+{nextRecoverySec}s</Text>
            )}
          </View>
        </View>

        {/* ペット描画エリア (Canvas) */}
        <View style={styles.petCanvas}>
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
            {/* ペットの影 */}
            <View style={styles.petShadow} />

            {/* ペット本体 (グラデーション風の球体) */}
            <View
              style={[
                styles.petBody,
                {
                  backgroundColor: petColors[0],
                  shadowColor: petColors[1],
                },
              ]}
            >
              {/* ペットの表情 */}
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
            <Text style={styles.statusLabel}>🍖 お腹</Text>
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

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>❤️ なつき</Text>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${affection}%`,
                    backgroundColor: '#ff3366',
                  },
                ]}
              />
            </View>
            <Text style={styles.statusVal}>{affection}%</Text>
          </View>
        </View>

        {/* チャット履歴表示エリア */}
        <View style={styles.chatSection}>
          <ScrollView
            ref={chatScrollRef}
            style={styles.chatScroll}
            contentContainerStyle={styles.chatContent}
          >
            {messages.map((msg) => (
              <View
                key={msg.id}
                style={[
                  styles.msgWrapper,
                  msg.sender === 'user'
                    ? styles.msgUser
                    : msg.sender === 'system'
                    ? styles.msgSystem
                    : msg.sender === 'pet',
                ]}
              >
                <View
                  style={[
                    styles.msgBubble,
                    msg.sender === 'user'
                      ? styles.bubbleUser
                      : msg.sender === 'system'
                      ? styles.bubbleSystem
                      : styles.bubblePet,
                  ]}
                >
                  <Text style={styles.msgText}>{msg.text}</Text>
                  <Text style={styles.msgTime}>{msg.time}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* 入力・操作アクションエリア */}
        <View style={styles.inputArea}>
          <View style={styles.chatInputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="あもれもんに話しかけてみよう..."
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
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: '#0a0f2d',
  },
  petWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 140,
    height: 140,
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
    transform: [{ scaleX: 1 }],
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
    marginBottom: 10,
  },
  statusLabel: {
    color: '#e5e7eb',
    fontSize: 12,
    width: 65,
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
  chatSection: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  chatScroll: {
    flex: 1,
    padding: 12,
  },
  chatContent: {
    paddingBottom: 20,
  },
  msgWrapper: {
    flexDirection: 'row',
    marginVertical: 4,
    width: '100%',
  },
  msgPet: {
    justifyContent: 'flex-start',
  },
  msgUser: {
    justifyContent: 'flex-end',
  },
  msgSystem: {
    justifyContent: 'center',
  },
  msgBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    maxWidth: '85%',
  },
  bubblePet: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  bubbleUser: {
    backgroundColor: '#1d4ed8',
    borderTopRightRadius: 4,
  },
  bubbleSystem: {
    backgroundColor: '#3f3f46',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  msgText: {
    color: '#f8fafc',
    fontSize: 13,
    lineHeight: 18,
  },
  msgTime: {
    color: '#94a3b8',
    fontSize: 9,
    alignSelf: 'flex-end',
    marginTop: 4,
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
