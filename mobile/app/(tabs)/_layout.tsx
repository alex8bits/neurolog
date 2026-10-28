import { Tabs } from 'expo-router';
import { PlatformPressable } from 'expo-router/react-navigation';
import type { BottomTabBarButtonProps } from 'expo-router/tabs';
import { StyleSheet, View } from 'react-native';
import type { ColorValue } from 'react-native';

import { useConnectivity } from '@/offline/ConnectivityContext';
import { colors, fontFamily } from '@/theme/tokens';
import { useUpdateCheck } from '@/updates/useUpdateCheck';

/** Иконка вкладки: скруглённый квадрат цвета вкладки (как .tabbar i в макете). */
function TabIcon({ color }: { color: ColorValue }) {
    return <View style={[styles.icon, { backgroundColor: color }]} />;
}

/** Кнопка вкладки по умолчанию (PlatformPressable со всеми пропсами
 *  навигатора), но для экранного диктора — в состоянии disabled. */
function DisabledTabButton(props: BottomTabBarButtonProps) {
    return (
        <PlatformPressable
            {...props}
            accessibilityState={{ ...props.accessibilityState, disabled: true }}
        />
    );
}

/** Опции вкладки, которой нужен сервер: офлайн приглушена, для диктора
 *  disabled и не открывается (tabPress отменяется в listeners). */
function serverTabOptions(title: string, online: boolean) {
    return {
        title,
        tabBarIcon: ({ color }: { color: ColorValue }) => (
            <TabIcon color={color} />
        ),
        tabBarItemStyle: online ? undefined : styles.disabledItem,
        tabBarButton: online ? undefined : DisabledTabButton,
        tabBarAccessibilityLabel: online
            ? title
            : `${title} — недоступно без интернета`,
    };
}

/**
 * Нижние вкладки «Журнал / Отчёт / Профиль». Группа (tabs) не попадает в
 * URL: index остаётся маршрутом «/». Экраны new, edit, settings и т.д.
 * живут в группе (journal) корневого Stack и открываются поверх вкладок.
 * Без сети «Отчёт» и «Профиль» недоступны — журнал работает офлайн.
 * Здесь же — единственный триггер проверки обновления (старт и возврат
 * из фона). Поверх /quick (тёплый старт иконкой «Приступ») проверка не
 * идёт — выполнится при возврате на вкладки.
 */
export default function TabsLayout() {
    const { online } = useConnectivity();

    useUpdateCheck();

    const blockOffline = {
        tabPress: (event: { preventDefault: () => void }) => {
            if (!online) {
                event.preventDefault();
            }
        },
    };

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.muted,
                tabBarLabelStyle: {
                    fontFamily: fontFamily.bold,
                    fontSize: 12,
                },
                tabBarStyle: {
                    backgroundColor: colors.white,
                    borderTopColor: colors.line,
                    borderTopWidth: StyleSheet.hairlineWidth,
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Журнал',
                    tabBarIcon: ({ color }) => <TabIcon color={color} />,
                }}
            />
            <Tabs.Screen
                name="report"
                options={serverTabOptions('Отчёт', online)}
                listeners={blockOffline}
            />
            <Tabs.Screen
                name="profile"
                options={serverTabOptions('Профиль', online)}
                listeners={blockOffline}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    icon: { borderRadius: 6, height: 20, width: 20 },
    disabledItem: { opacity: 0.4 },
});
