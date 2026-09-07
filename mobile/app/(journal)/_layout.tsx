import { Stack } from 'expo-router';

/**
 * Группа «Журнал» — владелец маршрута «/». На index шапка своя (в контенте,
 * консистентно с (auth)); edit, new и settings включают нативный header со
 * back точечными Stack.Screen поверх screenOptions.
 */
export default function JournalLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen
                name="edit"
                options={{ headerShown: true, title: 'Редактирование записи' }}
            />
            <Stack.Screen
                name="new"
                options={{ headerShown: true, title: 'Новая запись' }}
            />
            <Stack.Screen
                name="settings"
                options={{ headerShown: true, title: 'Настройки' }}
            />
        </Stack>
    );
}
