import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useRef } from 'react';
import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n/I18nProvider';
import { colors, radius, spacing } from '@/theme/tokens';

import { AppButton, AppText } from './primitives';

/** QR codes and the usual product / label barcodes. */
const BARCODE_TYPES = ['qr', 'ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'itf14', 'codabar', 'datamatrix'] as const;

/**
 * Full-screen camera reading one QR code or barcode. Mount it only while it is
 * needed (`{open ? <BarcodeScanner … /> : null}`): it reports the first code
 * read and ignores the next frames.
 */
export function BarcodeScanner({
  title,
  onScanned,
  onClose,
}: {
  title?: string;
  onScanned: (code: string) => void;
  onClose: () => void;
}) {
  const { locale } = useI18n();
  const tr = (fr: string, en: string, ar: string) => (locale === 'ar' ? ar : locale === 'en' ? en : fr);
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);

  const handleScan = (result: BarcodeScanningResult) => {
    const code = result.data?.trim();
    if (handled.current || !code) return;
    handled.current = true;
    onScanned(code);
  };

  let body;
  if (!permission) {
    body = null;
  } else if (!permission.granted) {
    body = (
      <View style={styles.permission}>
        <Ionicons name="camera-outline" size={48} color="#FFFFFF" />
        <AppText color="#FFFFFF" style={{ textAlign: 'center' }}>
          {tr(
            "L'accès à la caméra est nécessaire pour scanner les QR codes et codes-barres.",
            'Camera access is needed to scan QR codes and barcodes.',
            'خاص الوصول للكاميرا باش تسكاني QR code والباركود.',
          )}
        </AppText>
        {permission.canAskAgain ? (
          <AppButton title={tr('Autoriser la caméra', 'Allow camera', 'سماح بالكاميرا')} onPress={() => void requestPermission()} />
        ) : (
          <AppButton title={tr('Ouvrir les réglages', 'Open settings', 'فتح الإعدادات')} onPress={() => void Linking.openSettings()} />
        )}
      </View>
    );
  } else {
    body = (
      <>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
          onBarcodeScanned={handleScan}
        />
        <View pointerEvents="none" style={styles.frameWrap}>
          <View style={styles.frame} />
          <AppText color="#FFFFFF" style={styles.hint}>
            {tr('Placez le QR code ou le code-barres dans le cadre', 'Place the QR code or barcode inside the frame', 'حط QR code ولا الباركود وسط الإطار')}
          </AppText>
        </View>
      </>
    );
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        {body}
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <AppText variant="title" color="#FFFFFF" style={{ flex: 1 }} numberOfLines={1}>
            {title ?? tr('Scanner un code', 'Scan a code', 'سكاني كود')}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr('Fermer', 'Close', 'إغلاق')}
            onPress={onClose}
            hitSlop={12}
            style={styles.close}>
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  close: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  frameWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  frame: { width: 260, height: 260, borderRadius: radius.xl, borderWidth: 3, borderColor: colors.brand, backgroundColor: 'transparent' },
  hint: { textAlign: 'center', paddingHorizontal: spacing.xl },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
});
