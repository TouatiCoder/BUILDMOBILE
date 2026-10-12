import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Keyboard, Platform, ScrollView, View, type KeyboardEvent, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Keyboard handling that works with Android edge-to-edge (Expo SDK 57), where
 * the window is no longer resized when the keyboard opens, and on iOS.
 *
 * Instead of guessing header heights, it measures how much of a container the
 * keyboard actually covers (`measureInWindow` vs the keyboard's top edge) and
 * scrolls the focused field into view.
 */

const SHOW_EVENT = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const HIDE_EVENT = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

/** Height of `containerRef` hidden behind the keyboard (0 when closed). */
export function useKeyboardOverlap(containerRef: RefObject<View | null>): number {
  const [overlap, setOverlap] = useState(0);
  useEffect(() => {
    const onShow = (e: KeyboardEvent) => {
      const keyboardTop = e.endCoordinates.screenY;
      const node = containerRef.current;
      if (!node) {
        setOverlap(e.endCoordinates.height);
        return;
      }
      node.measureInWindow((_x, y, _w, h) => setOverlap(Math.max(0, y + h - keyboardTop)));
    };
    const show = Keyboard.addListener(SHOW_EVENT, onShow);
    const hide = Keyboard.addListener(HIDE_EVENT, () => setOverlap(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [containerRef]);
  return overlap;
}

type FocusTarget = { measureLayout: View['measureLayout'] } | null;

type KeyboardAwareContextValue = {
  /** Called by AppInput on focus so the scroll view can reveal it. */
  onInputFocus: (target: FocusTarget) => void;
};

const KeyboardAwareContext = createContext<KeyboardAwareContextValue | null>(null);

export function useKeyboardAware() {
  return useContext(KeyboardAwareContext);
}

/** Distance kept between the top of the visible area and the focused field. */
const REVEAL_MARGIN = 96;

/**
 * ScrollView that keeps focused inputs visible above the keyboard.
 * - `avoidKeyboard` (default): shrinks itself by the covered height.
 *   Set it to false when a parent already lifts the whole screen (e.g. a
 *   Screen with a sticky footer); focused fields are still scrolled into view.
 */
export function KeyboardAwareScrollView({
  children,
  avoidKeyboard = true,
  style,
  contentContainerStyle,
  innerStyle,
  ...rest
}: ScrollViewProps & { avoidKeyboard?: boolean; innerStyle?: StyleProp<ViewStyle>; children: ReactNode }) {
  const wrapperRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const focused = useRef<FocusTarget>(null);
  const overlap = useKeyboardOverlap(wrapperRef);

  const reveal = useCallback(() => {
    const target = focused.current;
    const content = contentRef.current;
    if (!target || !content) return;
    target.measureLayout(
      content,
      (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - REVEAL_MARGIN), animated: true }),
      () => undefined,
    );
  }, []);

  // When the keyboard opens (or its size changes), reveal the focused field
  // once the layout has absorbed the new bottom margin.
  useEffect(() => {
    const sub = Keyboard.addListener(SHOW_EVENT, () => setTimeout(reveal, Platform.OS === 'ios' ? 250 : 80));
    return () => sub.remove();
  }, [reveal]);

  const value = useMemo<KeyboardAwareContextValue>(
    () => ({
      onInputFocus: (target) => {
        focused.current = target;
        // Moving between fields while the keyboard is already open.
        if (Keyboard.isVisible()) setTimeout(reveal, 50);
      },
    }),
    [reveal],
  );

  return (
    <KeyboardAwareContext.Provider value={value}>
      <View ref={wrapperRef} style={{ flex: 1 }} collapsable={false}>
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          {...rest}
          style={[{ flex: 1 }, style, avoidKeyboard && overlap > 0 ? { marginBottom: overlap } : null]}
          contentContainerStyle={contentContainerStyle}>
          <View ref={contentRef} collapsable={false} style={innerStyle}>
            {children}
          </View>
        </ScrollView>
      </View>
    </KeyboardAwareContext.Provider>
  );
}
