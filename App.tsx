import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Bell,
  Building2,
  Camera,
  Check,
  Clock3,
  List,
  Map as MapIcon,
  MapPin,
  Plus,
  ShieldCheck,
  TimerReset,
  Utensils,
  Users,
  X,
} from 'lucide-react-native';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { CampusMap } from './src/components/CampusMap';
import {
  CAMPUS_ROLES,
  CAMPUS_BUILDINGS,
  CATERING_CLEAROUT_DURATION_MS,
  CATERING_CLEAROUT_TYPE,
  CSUEB_EMAIL_DOMAIN,
  DROP_DURATION_MS,
  FOOD_PHOTOS,
  FOOD_TYPES,
  MAJORS,
  buildSeedDrops,
  getBuildingCoordinate,
  getBuildingShortName,
} from './src/data/campus';
import { createDropGateway } from './src/services/realtime';
import {
  configureNotifications,
  getNotificationRadiusMiles,
  notifyNearbyFoodDrop,
} from './src/services/notifications';
import { FoodDrop, UserProfile, UserRole } from './src/types';
import {
  createDropId,
  formatTimeLeft,
  getDropColor,
  getDropLabel,
} from './src/utils/drops';

type AuthStage = 'login' | 'duo' | 'setup' | 'app';
type ActiveTab = 'map' | 'list';

type PostForm = {
  buildingName: string;
  roomNumber: string;
  foodType: string;
  dropType: FoodDrop['dropType'];
  servingsLeft: string;
  photoUri?: string;
};

const theme = {
  background: '#071013',
  surface: '#0D171B',
  panel: '#101D22',
  panelStrong: '#16262D',
  border: '#26373F',
  borderStrong: '#3D565F',
  text: '#F7FBFC',
  muted: '#AABBC1',
  dim: '#74868C',
  accent: '#2FE07B',
  accentDark: '#123C28',
  yellow: '#FFD166',
  danger: '#FF6B6B',
  warningDark: '#3E3212',
};

const CSUEB_EMAIL_PATTERN = new RegExp(
  `^[^\\s@]+@${CSUEB_EMAIL_DOMAIN.replaceAll('.', '\\.')}$`,
  'i',
);

const defaultPostBuilding = (role: UserRole) =>
  role === 'catering'
    ? (CAMPUS_BUILDINGS.find((building) => building.shortName === 'DC') ??
        CAMPUS_BUILDINGS[0])
    : CAMPUS_BUILDINGS[0];

const initialPostForm = (role: UserRole = 'student'): PostForm => ({
  buildingName: defaultPostBuilding(role).name,
  roomNumber: '',
  foodType: role === 'catering' ? CATERING_CLEAROUT_TYPE : FOOD_TYPES[0],
  dropType: role === 'catering' ? 'catering_clearout' : 'standard',
  servingsLeft: role === 'catering' ? '24' : '8',
});

export default function App() {
  const gateway = useMemo(() => createDropGateway(buildSeedDrops()), []);
  const seenDropIdsRef = useRef(new Set<string>());
  const initialLoadCompleteRef = useRef(false);

  const [authStage, setAuthStage] = useState<AuthStage>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberLogin, setRememberLogin] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [verificationCode, setVerificationCode] = useState('246810');
  const [enteredCode, setEnteredCode] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [setupBuilding, setSetupBuilding] = useState('');
  const [setupMajor, setSetupMajor] = useState('');
  const [setupRole, setSetupRole] = useState<UserRole>('student');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [drops, setDrops] = useState<FoodDrop[]>([]);
  const [now, setNow] = useState(Date.now());
  const [activeTab, setActiveTab] = useState<ActiveTab>('map');
  const [selectedDropId, setSelectedDropId] = useState<string | undefined>();
  const [postOpen, setPostOpen] = useState(false);
  const [postForm, setPostForm] = useState<PostForm>(initialPostForm);
  const [postError, setPostError] = useState('');
  const [busyDropId, setBusyDropId] = useState<string | null>(null);

  useEffect(() => {
    return gateway.subscribe((nextDrops) => {
      setDrops(nextDrops);
      setSelectedDropId((current) =>
        current && nextDrops.some((drop) => drop.id === current)
          ? current
          : nextDrops[0]?.id,
      );
    });
  }, [gateway]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
      void gateway.pruneExpired();
    }, 30000);

    return () => clearInterval(interval);
  }, [gateway]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    void configureNotifications();
  }, [profile]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    if (!initialLoadCompleteRef.current) {
      seenDropIdsRef.current = new Set(drops.map((drop) => drop.id));
      initialLoadCompleteRef.current = true;
      return;
    }

    drops.forEach((drop) => {
      if (seenDropIdsRef.current.has(drop.id)) {
        return;
      }

      seenDropIdsRef.current.add(drop.id);
      void notifyNearbyFoodDrop(drop, profile);
    });
  }, [drops, profile]);

  const selectedDrop = drops.find((drop) => drop.id === selectedDropId);

  const handleStartDuo = () => {
    const rawLogin = email.trim().toLowerCase();
    const trimmedEmail = rawLogin.includes('@')
      ? rawLogin
      : `${rawLogin}@${CSUEB_EMAIL_DOMAIN}`;

    if (!rawLogin || !password.trim()) {
      setEmailError('Enter your NetID and password.');
      return;
    }

    if (!CSUEB_EMAIL_PATTERN.test(trimmedEmail)) {
      setEmailError(`Use your @${CSUEB_EMAIL_DOMAIN} account.`);
      return;
    }

    const nextCode = String(Math.floor(100000 + Math.random() * 900000));
    setEmail(trimmedEmail);
    setPassword('');
    setVerificationCode(nextCode);
    setEnteredCode('');
    setVerifyError('');
    setAuthStage('duo');
  };

  const handleApproveDuo = () => {
    if (enteredCode.trim() && enteredCode.trim() !== verificationCode) {
      setVerifyError('That Duo passcode does not match.');
      return;
    }

    setAuthStage('setup');
  };

  const handleCompleteSetup = () => {
    if (!setupBuilding || !setupMajor || !setupRole) {
      return;
    }

    setProfile({
      email,
      verifiedAt: Date.now(),
      primaryBuilding: setupBuilding,
      major: setupMajor,
      role: setupRole,
      notificationRadiusMiles: getNotificationRadiusMiles(),
    });
    setPostForm(initialPostForm(setupRole));
    setAuthStage('app');
  };

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo access to add a drop image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.82,
    });

    if (!result.canceled) {
      setPostForm((current) => ({
        ...current,
        photoUri: result.assets[0]?.uri,
      }));
    }
  };

  const handleCreateDrop = async () => {
    if (!profile) {
      return;
    }

    const servings = Number.parseInt(postForm.servingsLeft, 10);
    const roomNumber = postForm.roomNumber.trim();

    if (!postForm.buildingName || !roomNumber || !postForm.foodType) {
      setPostError('Building, room, food type, and servings are required.');
      return;
    }

    if (!Number.isFinite(servings) || servings < 1) {
      setPostError('Servings must be at least 1.');
      return;
    }

    const coordinate = getBuildingCoordinate(postForm.buildingName);
    const createdAt = Date.now();
    const drop: FoodDrop = {
      id: createDropId(),
      buildingName: postForm.buildingName,
      roomNumber,
      foodType: postForm.foodType,
      dropType: postForm.dropType,
      photoUri: postForm.photoUri ?? FOOD_PHOTOS[postForm.foodType],
      servingsLeft: servings,
      createdAt,
      expiresAt:
        createdAt +
        (postForm.dropType === 'catering_clearout'
          ? CATERING_CLEAROUT_DURATION_MS
          : DROP_DURATION_MS),
      status: 'active',
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      ownerEmail: profile.email,
      postedByRole: profile.role,
      claimedBy: [],
      reportsGone: [],
    };

    try {
      await gateway.createDrop(drop);
      setNow(createdAt);
      setSelectedDropId(drop.id);
      setPostForm(initialPostForm(profile.role));
      setPostError('');
      setPostOpen(false);
      await notifyNearbyFoodDrop(drop, profile);
    } catch (error) {
      setPostError(error instanceof Error ? error.message : 'Could not post food.');
    }
  };

  const handleClaim = async (drop: FoodDrop) => {
    if (!profile) {
      return;
    }

    setBusyDropId(drop.id);

    try {
      await gateway.claimDrop(drop.id, profile.email);
    } finally {
      setBusyDropId(null);
    }
  };

  const handleGone = async (drop: FoodDrop) => {
    if (!profile) {
      return;
    }

    setBusyDropId(drop.id);

    try {
      await gateway.markGone(drop.id, profile.email);
    } finally {
      setBusyDropId(null);
    }
  };

  const handleExtend = async (drop: FoodDrop) => {
    if (!profile) {
      return;
    }

    setBusyDropId(drop.id);

    try {
      await gateway.extendDrop(
        drop.id,
        profile.email,
        drop.dropType === 'catering_clearout' ? 15 : 30,
      );
    } finally {
      setBusyDropId(null);
    }
  };

  if (authStage === 'login') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.portalScroll}>
          <View style={styles.portalCard}>
            <View style={styles.portalHeader}>
              <Image
                source={require('./assets/csueb-wordmark.png')}
                resizeMode="contain"
                style={styles.csuebWordmark}
              />
              <Text style={styles.portalTitle}>Login to EAB</Text>
            </View>

            <View style={styles.portalBody}>
              <Text style={styles.portalWarning}>
                Warning - unauthorized access, attempted access, or misuse of any State
                computing system is a violation of Section 502 of the California Penal
                Code and/or applicable Federal Laws.
              </Text>

              <View style={styles.eabBrandRow}>
                <View style={styles.eabIconCircle}>
                  <Building2 color="#FFFFFF" size={56} strokeWidth={1.9} />
                </View>
                <Text style={styles.eabWordmark}>EAB</Text>
              </View>

              <Text style={styles.portalLabel}>NetID</Text>
              <TextInput
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setEmailError('');
                }}
                placeholder={`netid@${CSUEB_EMAIL_DOMAIN}`}
                placeholderTextColor="#718089"
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.portalInput}
                returnKeyType="next"
              />

              <Text style={styles.portalLabel}>Password</Text>
              <TextInput
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setEmailError('');
                }}
                placeholder="Password"
                placeholderTextColor="#718089"
                secureTextEntry
                style={styles.portalInput}
                returnKeyType="go"
                onSubmitEditing={handleStartDuo}
              />

              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberLogin }}
                onPress={() => setRememberLogin((current) => !current)}
                style={({ pressed }) => [
                  styles.rememberRow,
                  pressed && styles.portalPressed,
                ]}
              >
                <View style={styles.rememberBox}>
                  {rememberLogin ? (
                    <Check color="#2437EA" size={18} strokeWidth={3} />
                  ) : null}
                </View>
                <Text style={styles.rememberLabel}>Don't Remember Login</Text>
              </Pressable>

              {emailError ? <Text style={styles.portalErrorText}>{emailError}</Text> : null}

              <Pressable
                accessibilityRole="button"
                onPress={handleStartDuo}
                style={({ pressed }) => [
                  styles.portalLoginButton,
                  pressed && styles.portalPressed,
                ]}
              >
                <Text style={styles.portalLoginText}>Login</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (authStage === 'duo') {
    return (
      <AuthShell>
        <View style={styles.iconCircle}>
          <ShieldCheck color={theme.accent} size={34} strokeWidth={2.4} />
        </View>
        <Text style={styles.authTitle}>Duo two-factor check.</Text>
        <Text style={styles.subtleText}>{email}</Text>
        <View style={styles.codeBox}>
          <Text style={styles.duoTitle}>Duo Push</Text>
          <Text style={styles.duoDetail}>Mock passcode: {verificationCode}</Text>
        </View>
        <TextInput
          value={enteredCode}
          onChangeText={(value) => {
            setEnteredCode(value);
            setVerifyError('');
          }}
          placeholder="Optional Duo passcode"
          placeholderTextColor={theme.dim}
          keyboardType="number-pad"
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={handleApproveDuo}
        />
        {verifyError ? <Text style={styles.errorText}>{verifyError}</Text> : null}
        <PrimaryButton icon={Check} label="Approve Duo Push" onPress={handleApproveDuo} />
        <SecondaryButton
          label="Use another email"
          onPress={() => {
            setPassword('');
            setAuthStage('login');
          }}
        />
      </AuthShell>
    );
  }

  if (authStage === 'setup') {
    return (
      <AuthShell wide>
        <Text style={styles.authTitle}>Set your campus anchor.</Text>
        <Text style={styles.sectionLabel}>Primary building</Text>
        <View style={styles.chipGrid}>
          {CAMPUS_BUILDINGS.map((building) => (
            <ChoiceChip
              key={building.name}
              selected={setupBuilding === building.name}
              label={building.shortName}
              detail={building.description}
              onPress={() => setSetupBuilding(building.name)}
            />
          ))}
        </View>
        <Text style={styles.sectionLabel}>Major</Text>
        <View style={styles.chipGrid}>
          {MAJORS.map((major) => (
            <ChoiceChip
              key={major}
              selected={setupMajor === major}
              label={major}
              onPress={() => setSetupMajor(major)}
            />
          ))}
        </View>
        <Text style={styles.sectionLabel}>Campus role</Text>
        <View style={styles.chipGrid}>
          {CAMPUS_ROLES.map((role) => (
            <ChoiceChip
              key={role.value}
              selected={setupRole === role.value}
              label={role.label}
              detail={role.detail}
              onPress={() => setSetupRole(role.value)}
            />
          ))}
        </View>
        <PrimaryButton
          icon={Bell}
          label="Enter feed"
          disabled={!setupBuilding || !setupMajor || !setupRole}
          onPress={handleCompleteSetup}
        />
      </AuthShell>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.appShell}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>CampusBites</Text>
            <Text style={styles.headerTitle}>CSUEB food drops</Text>
          </View>
          <View style={styles.headerMeta}>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>
                {gateway.mode === 'supabase' ? 'Supabase' : 'Demo live'}
              </Text>
            </View>
            <Text style={styles.headerBuilding}>
              {profile ? getBuildingShortName(profile.primaryBuilding) : ''}
            </Text>
          </View>
        </View>

        <View style={styles.profileStrip}>
          <View style={styles.stripItem}>
            <Building2 color={theme.accent} size={18} />
            <Text style={styles.stripText}>
              {profile ? getBuildingShortName(profile.primaryBuilding) : ''}
            </Text>
          </View>
          <View style={styles.stripItem}>
            <Users color={theme.yellow} size={18} />
            <Text style={styles.stripText}>{profile?.major}</Text>
          </View>
          <View style={styles.stripItem}>
            <Utensils color="#B7F7C8" size={18} />
            <Text style={styles.stripText}>
              {profile?.role === 'catering' ? 'Pioneer Kitchen' : 'Student'}
            </Text>
          </View>
          <View style={styles.stripItem}>
            <Bell color="#77D9FF" size={18} />
            <Text style={styles.stripText}>0.5 mi</Text>
          </View>
        </View>

        <View style={styles.tabBar}>
          <TabButton
            active={activeTab === 'map'}
            icon={MapIcon}
            label="Map"
            onPress={() => setActiveTab('map')}
          />
          <TabButton
            active={activeTab === 'list'}
            icon={List}
            label="List"
            onPress={() => setActiveTab('list')}
          />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.feedContent}
        >
          {activeTab === 'map' ? (
            <>
              <CampusMap
                drops={drops}
                selectedDropId={selectedDropId}
                onSelectDrop={(drop) => setSelectedDropId(drop.id)}
                now={now}
              />
              {selectedDrop ? (
                <FoodDropCard
                  drop={selectedDrop}
                  now={now}
                  currentUserEmail={profile?.email ?? ''}
                  busy={busyDropId === selectedDrop.id}
                  onClaim={handleClaim}
                  onGone={handleGone}
                  onExtend={handleExtend}
                />
              ) : (
                <EmptyState />
              )}
            </>
          ) : (
            <>
              {drops.length === 0 ? <EmptyState /> : null}
              {drops.map((drop) => (
                <FoodDropCard
                  key={drop.id}
                  drop={drop}
                  now={now}
                  currentUserEmail={profile?.email ?? ''}
                  busy={busyDropId === drop.id}
                  onClaim={handleClaim}
                  onGone={handleGone}
                  onExtend={handleExtend}
                />
              ))}
            </>
          )}
        </ScrollView>

        <Pressable
          accessibilityRole="button"
          style={styles.floatingPostButton}
          onPress={() => {
            setPostForm(initialPostForm(profile?.role ?? 'student'));
            setPostOpen(true);
          }}
        >
          <Plus color={theme.background} size={22} strokeWidth={3} />
          <Text style={styles.floatingPostText}>
            {profile?.role === 'catering' ? 'Clear-out' : 'Post Food'}
          </Text>
        </Pressable>
      </View>

      <PostFoodModal
        visible={postOpen}
        form={postForm}
        error={postError}
        onChange={setPostForm}
        userRole={profile?.role ?? 'student'}
        onPickPhoto={handlePickPhoto}
        onClose={() => {
          setPostOpen(false);
          setPostError('');
        }}
        onSubmit={handleCreateDrop}
      />
    </SafeAreaView>
  );
}

function AuthShell({
  children,
  wide,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.authScroll}>
        <View style={[styles.authPanel, wide && styles.authPanelWide]}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PrimaryButton({
  icon: Icon,
  label,
  onPress,
  disabled,
}: {
  icon: typeof Utensils;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Icon color={theme.background} size={19} strokeWidth={2.8} />
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function ChoiceChip({
  selected,
  label,
  detail,
  onPress,
}: {
  selected: boolean;
  label: string;
  detail?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceChip,
        selected && styles.choiceChipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>
        {label}
      </Text>
      {detail ? <Text style={styles.choiceDetail}>{detail}</Text> : null}
    </Pressable>
  );
}

function TabButton({
  active,
  icon: Icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: typeof Utensils;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tabButton, active && styles.tabButtonActive]}
    >
      <Icon color={active ? theme.background : theme.muted} size={18} />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function FoodDropCard({
  drop,
  now,
  currentUserEmail,
  busy,
  onClaim,
  onGone,
  onExtend,
}: {
  drop: FoodDrop;
  now: number;
  currentUserEmail: string;
  busy: boolean;
  onClaim: (drop: FoodDrop) => void;
  onGone: (drop: FoodDrop) => void;
  onExtend: (drop: FoodDrop) => void;
}) {
  const gone = drop.status === 'sold_out' || drop.servingsLeft <= 0;
  const claimed = drop.claimedBy.includes(currentUserEmail);
  const owner = drop.ownerEmail === currentUserEmail;
  const isClearout = drop.dropType === 'catering_clearout';
  const statusColor = getDropColor(drop, now);
  const claimDisabled = gone || claimed || busy;
  const fallbackPhoto = FOOD_PHOTOS[drop.foodType] ?? FOOD_PHOTOS.Pizza;
  const extendMinutes = isClearout ? 15 : 30;

  return (
    <View style={styles.dropCard}>
      <Image
        source={{ uri: drop.photoUri ?? fallbackPhoto }}
        style={styles.dropImage}
        resizeMode="cover"
      />
      <View style={styles.dropBody}>
        <View style={styles.dropTopRow}>
          <View style={styles.dropTitleGroup}>
            <Text style={styles.dropFood}>{drop.foodType}</Text>
            <Text style={styles.dropLocation}>
              {isClearout ? 'Pioneer Kitchen · ' : ''}
              {getBuildingShortName(drop.buildingName)} · {drop.roomNumber}
            </Text>
          </View>
          <View style={[styles.statusPill, { borderColor: statusColor }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={styles.statusText}>{getDropLabel(drop, now)}</Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <Metric icon={Users} value={String(drop.servingsLeft)} label="left" />
          <Metric icon={Clock3} value={formatTimeLeft(drop.expiresAt, now)} label="timer" />
          <Metric
            icon={MapPin}
            value={drop.reportsGone.length ? String(drop.reportsGone.length) : '0'}
            label="gone"
          />
        </View>

        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            disabled={claimDisabled}
            onPress={() => onClaim(drop)}
            style={({ pressed }) => [
              styles.claimButton,
              claimDisabled && styles.disabledAction,
              pressed && !claimDisabled && styles.pressed,
            ]}
          >
            <Check color={theme.background} size={17} strokeWidth={3} />
            <Text style={styles.claimButtonText}>
              {claimed ? 'Claimed' : 'Claiming'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={gone || busy}
            onPress={() => onGone(drop)}
            style={({ pressed }) => [
              styles.goneButton,
              (gone || busy) && styles.disabledOutline,
              pressed && !gone && !busy && styles.pressed,
            ]}
          >
            <X color={gone ? theme.dim : theme.danger} size={17} strokeWidth={2.8} />
            <Text style={[styles.goneButtonText, gone && styles.mutedActionText]}>
              It's Gone!
            </Text>
          </Pressable>
        </View>

        {owner && !gone ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => onExtend(drop)}
            style={({ pressed }) => [styles.extendButton, pressed && styles.pressed]}
          >
            <TimerReset color={theme.accent} size={17} />
            <Text style={styles.extendText}>Extend {extendMinutes}m</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Metric({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Utensils;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.metric}>
      <Icon color={theme.muted} size={15} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Utensils color={theme.dim} size={30} />
      <Text style={styles.emptyTitle}>No visible drops</Text>
    </View>
  );
}

function PostFoodModal({
  visible,
  form,
  error,
  userRole,
  onChange,
  onPickPhoto,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  form: PostForm;
  error: string;
  userRole: UserRole;
  onChange: Dispatch<SetStateAction<PostForm>>;
  onPickPhoto: () => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const isCatering = userRole === 'catering';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <View style={styles.postModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {isCatering ? 'Catering Clear-out' : 'Post Food'}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={styles.closeButton}
            >
              <X color={theme.text} size={21} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionLabel}>Building Name</Text>
            <View style={styles.chipGrid}>
              {CAMPUS_BUILDINGS.map((building) => (
                <ChoiceChip
                  key={building.name}
                  selected={form.buildingName === building.name}
                  label={building.shortName}
                  onPress={() =>
                    onChange((current) => ({
                      ...current,
                      buildingName: building.name,
                    }))
                  }
                />
              ))}
            </View>

            <Text style={styles.sectionLabel}>Room Number</Text>
            <TextInput
              value={form.roomNumber}
              onChangeText={(roomNumber) =>
                onChange((current) => ({ ...current, roomNumber }))
              }
              placeholder="Room 204, lobby, courtyard"
              placeholderTextColor={theme.dim}
              style={styles.input}
            />

            <Text style={styles.sectionLabel}>
              {isCatering ? 'Alert Type' : 'Food Type'}
            </Text>
            <View style={styles.chipGrid}>
              {isCatering ? (
                <ChoiceChip
                  selected
                  label={CATERING_CLEAROUT_TYPE}
                  detail="15-minute Pioneer Kitchen alert"
                  onPress={() =>
                    onChange((current) => ({
                      ...current,
                      foodType: CATERING_CLEAROUT_TYPE,
                      dropType: 'catering_clearout',
                    }))
                  }
                />
              ) : (
                FOOD_TYPES.map((foodType) => (
                  <ChoiceChip
                    key={foodType}
                    selected={form.foodType === foodType}
                    label={foodType}
                    onPress={() =>
                      onChange((current) => ({
                        ...current,
                        foodType,
                        dropType: 'standard',
                        photoUri: current.photoUri,
                      }))
                    }
                  />
                ))
              )}
            </View>

            <Text style={styles.sectionLabel}>Estimated Servings</Text>
            <TextInput
              value={form.servingsLeft}
              onChangeText={(servingsLeft) =>
                onChange((current) => ({ ...current, servingsLeft }))
              }
              placeholder={isCatering ? '24' : '8'}
              placeholderTextColor={theme.dim}
              keyboardType="number-pad"
              style={styles.input}
            />

            <Text style={styles.sectionLabel}>Photo Upload</Text>
            <Pressable
              accessibilityRole="button"
              onPress={onPickPhoto}
              style={({ pressed }) => [styles.photoPicker, pressed && styles.pressed]}
            >
              {form.photoUri ? (
                <Image source={{ uri: form.photoUri }} style={styles.photoPreview} />
              ) : (
                <>
                  <Camera color={theme.accent} size={24} />
                  <Text style={styles.photoText}>Choose photo</Text>
                </>
              )}
            </Pressable>

            <View style={styles.timerNotice}>
              <Clock3 color={theme.yellow} size={18} />
              <Text style={styles.timerText}>
                {isCatering ? 'Self-destructs in 15m' : 'Self-destructs in 2h'}
              </Text>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <PrimaryButton
              icon={Plus}
              label={isCatering ? 'Publish clear-out' : 'Publish drop'}
              onPress={onSubmit}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  appShell: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  authScroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  authPanel: {
    width: '100%',
    maxWidth: 440,
    gap: 18,
  },
  authPanelWide: {
    maxWidth: 620,
  },
  portalScroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  portalCard: {
    width: '100%',
    maxWidth: 860,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
  },
  portalHeader: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E9EC',
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 30,
    gap: 22,
  },
  csuebWordmark: {
    width: '100%',
    maxWidth: 520,
    height: 118,
  },
  portalTitle: {
    color: '#34444B',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  portalBody: {
    paddingHorizontal: 28,
    paddingTop: 26,
    paddingBottom: 30,
  },
  portalWarning: {
    color: '#34444B',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    marginBottom: 22,
  },
  eabBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginBottom: 22,
  },
  eabIconCircle: {
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: '#2E79BE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eabWordmark: {
    color: '#34444B',
    fontSize: 76,
    lineHeight: 82,
    fontWeight: '400',
  },
  portalLabel: {
    color: '#34444B',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 6,
  },
  portalInput: {
    minHeight: 52,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#34444B',
    color: '#16242A',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 10,
    marginTop: 2,
    marginBottom: 16,
  },
  rememberBox: {
    width: 32,
    height: 32,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#34444B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rememberLabel: {
    color: '#34444B',
    fontSize: 16,
    fontWeight: '700',
  },
  portalErrorText: {
    color: '#A52727',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
  },
  portalLoginButton: {
    minHeight: 54,
    minWidth: 210,
    borderRadius: 5,
    backgroundColor: '#2437EA',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 34,
  },
  portalLoginText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  portalPressed: {
    opacity: 0.78,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoMark: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    color: theme.text,
    fontSize: 24,
    fontWeight: '900',
  },
  iconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accentDark,
    borderWidth: 1,
    borderColor: '#24774E',
  },
  authTitle: {
    color: theme.text,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '900',
  },
  subtleText: {
    color: theme.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  sectionLabel: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 6,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.borderStrong,
    color: theme.text,
    backgroundColor: theme.surface,
    paddingHorizontal: 15,
    fontSize: 16,
    fontWeight: '700',
  },
  codeBox: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.borderStrong,
    backgroundColor: theme.panelStrong,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  codeText: {
    color: theme.accent,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0,
  },
  duoTitle: {
    color: theme.accent,
    fontSize: 24,
    fontWeight: '900',
  },
  duoDetail: {
    color: theme.muted,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  errorText: {
    color: '#FFB4B4',
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: theme.background,
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.75,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  choiceChip: {
    minHeight: 44,
    minWidth: 92,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingHorizontal: 12,
    paddingVertical: 9,
    justifyContent: 'center',
  },
  choiceChipSelected: {
    borderColor: theme.accent,
    backgroundColor: theme.accentDark,
  },
  choiceLabel: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '800',
  },
  choiceLabelSelected: {
    color: theme.accent,
  },
  choiceDetail: {
    color: theme.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  kicker: {
    color: theme.accent,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: theme.text,
    fontSize: 28,
    fontWeight: '900',
    marginTop: 2,
  },
  headerMeta: {
    alignItems: 'flex-end',
    gap: 8,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: '#235943',
    backgroundColor: theme.accentDark,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.accent,
  },
  liveText: {
    color: theme.accent,
    fontSize: 12,
    fontWeight: '900',
  },
  headerBuilding: {
    color: theme.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  profileStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  stripItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  stripText: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '800',
  },
  tabBar: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    padding: 5,
  },
  tabButton: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderRadius: 6,
  },
  tabButtonActive: {
    backgroundColor: theme.accent,
  },
  tabText: {
    color: theme.muted,
    fontSize: 14,
    fontWeight: '900',
  },
  tabTextActive: {
    color: theme.background,
  },
  feedContent: {
    gap: 16,
    paddingTop: 16,
    paddingBottom: 116,
  },
  dropCard: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.panel,
  },
  dropImage: {
    width: '100%',
    height: 154,
    backgroundColor: theme.panelStrong,
  },
  dropBody: {
    gap: 14,
    padding: 14,
  },
  dropTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  dropTitleGroup: {
    flex: 1,
  },
  dropFood: {
    color: theme.text,
    fontSize: 22,
    fontWeight: '900',
  },
  dropLocation: {
    color: theme.muted,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 3,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: '#0A1215',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: theme.text,
    fontSize: 12,
    fontWeight: '900',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metric: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  metricValue: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '900',
  },
  metricLabel: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  claimButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  claimButtonText: {
    color: theme.background,
    fontSize: 15,
    fontWeight: '900',
  },
  goneButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#5B3034',
    backgroundColor: '#261316',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  goneButtonText: {
    color: '#FFB4B4',
    fontSize: 15,
    fontWeight: '900',
  },
  disabledAction: {
    backgroundColor: '#2F4A3C',
    opacity: 0.75,
  },
  disabledOutline: {
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  mutedActionText: {
    color: theme.dim,
  },
  extendButton: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#235943',
    backgroundColor: theme.accentDark,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  extendText: {
    color: theme.accent,
    fontSize: 14,
    fontWeight: '900',
  },
  emptyState: {
    minHeight: 160,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.panel,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyTitle: {
    color: theme.muted,
    fontSize: 15,
    fontWeight: '900',
  },
  floatingPostButton: {
    position: 'absolute',
    right: 18,
    bottom: 24,
    minHeight: 54,
    borderRadius: 8,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.38,
    shadowRadius: 18,
  },
  floatingPostText: {
    color: theme.background,
    fontSize: 16,
    fontWeight: '900',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  postModal: {
    maxHeight: '92%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.panel,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 28,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    color: theme.text,
    fontSize: 24,
    fontWeight: '900',
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  photoPicker: {
    minHeight: 128,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.borderStrong,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: 168,
  },
  photoText: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '900',
  },
  timerNotice: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6B551B',
    backgroundColor: theme.warningDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  timerText: {
    color: theme.yellow,
    fontSize: 14,
    fontWeight: '900',
  },
});
