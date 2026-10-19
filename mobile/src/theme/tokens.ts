/** Дизайн-токены «Спокойный день+» (макет design-concepts/e-calm-plus.html). */
export const colors = {
    background: '#F1F6F5',
    surface: '#FFFFFF',
    white: '#FFFFFF',
    text: '#16323A',
    muted: '#587278',
    line: '#D8E4E3',
    primary: '#0F766E',
    primarySoft: '#D6EEEA',
    /** Лента 30 дней: 0, 1, 2, 3+ приступа. */
    strip0: '#E3ECEB',
    strip1: '#BFE3DE',
    strip2: '#5FB3AA',
    strip3: '#0F766E',
    sun: '#F2A93B',
    sunSoft: '#FCEBC9',
    danger: '#B93A2E',
    ok: '#2E7D4F',
    /** Фон переключателя (сегментов). */
    segmentTrack: '#DDEAE8',
    /** Затемнение под шторкой. */
    overlay: 'rgba(22, 50, 58, 0.18)',
} as const;

export type Colors = typeof colors;

export const radius = {
    cell: 5,
    control: 10,
    sheet: 16,
    modal: 24,
} as const;

export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
} as const;

export const fontFamily = {
    regular: 'Manrope_400Regular',
    medium: 'Manrope_500Medium',
    semibold: 'Manrope_600SemiBold',
    bold: 'Manrope_700Bold',
    extrabold: 'Manrope_800ExtraBold',
} as const;

export const type = {
    display: { fontSize: 34, lineHeight: 42, fontFamily: fontFamily.extrabold },
    title: { fontSize: 22, lineHeight: 30, fontFamily: fontFamily.extrabold },
    heading: { fontSize: 18, lineHeight: 26, fontFamily: fontFamily.bold },
    body: { fontSize: 16, lineHeight: 24, fontFamily: fontFamily.medium },
    label: { fontSize: 14, lineHeight: 20, fontFamily: fontFamily.semibold },
    caption: { fontSize: 12, lineHeight: 16, fontFamily: fontFamily.semibold },
} as const;

export type TypeVariant = keyof typeof type;

export const shadow = {
    segment: {
        shadowColor: '#16323A',
        shadowOpacity: 0.12,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
    },
} as const;
