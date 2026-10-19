import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import type { ColorValue } from 'react-native';

import { colors, fontFamily } from '@/theme/tokens';

/** Иконка вкладки: скруглённый квадрат цвета вкладки (как .tabbar i в макете). */
function TabIcon({ color }: { color: ColorValue }) {
    return <View style={[styles.icon, { backgroundColor: color }]} />;
}

/**
 * Нижние вкладки «Журнал / Отчёт / Профиль». Группа (tabs) не попадает в
 * URL: index остаётся маршрутом «/». Экраны new, edit, settings и т.д.
 * живут в группе (journal) корневого Stack и открываются поверх вкладок.
 */
export default function TabsLayout() {
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
                options={{
                    title: 'Отчёт',
                    tabBarIcon: ({ color }) => <TabIcon color={color} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Профиль',
                    tabBarIcon: ({ color }) => <TabIcon color={color} />,
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    icon: { borderRadius: 6, height: 20, width: 20 },
});
