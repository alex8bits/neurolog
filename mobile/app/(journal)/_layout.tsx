import { Stack } from 'expo-router';

import { colors, fontFamily } from '@/theme/tokens';

/** Нативный заголовок в палитре «Спокойный день+». */
const headerOptions = {
    headerShown: true,
    headerShadowVisible: false,
    headerTintColor: colors.text,
    headerStyle: { backgroundColor: colors.background },
    headerTitleStyle: {
        color: colors.text,
        fontFamily: fontFamily.semibold,
    },
    contentStyle: { backgroundColor: colors.background },
} as const;

/**
 * Группа «Журнал» — экраны поверх вкладок (маршрут «/» в группе (tabs)):
 * edit, email-doctor, feedback и settings — нативный header со back;
 * new — шторка снизу (transparentModal) без заголовка.
 */
export default function JournalLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen
                name="edit"
                options={{ ...headerOptions, title: 'Редактирование записи' }}
            />
            <Stack.Screen
                name="email-doctor"
                options={{ ...headerOptions, title: 'Отправить доктору' }}
            />
            <Stack.Screen
                name="feedback"
                options={{ ...headerOptions, title: 'Обратная связь' }}
            />
            <Stack.Screen
                name="new"
                options={{
                    headerShown: false,
                    presentation: 'transparentModal',
                    animation: 'slide_from_bottom',
                    contentStyle: { backgroundColor: 'transparent' },
                }}
            />
            <Stack.Screen
                name="settings"
                options={{ ...headerOptions, title: 'Настройки' }}
            />
        </Stack>
    );
}
