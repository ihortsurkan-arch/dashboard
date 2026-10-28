# Landing Stats

Веб-застосунок для перегляду статистики трафіку лендингів моделей із GA4: вхід за логіном і паролем, ролі адміна й користувача, вибір лендингу й періоду з порівнянням із попереднім періодом.

**Стек:** Nuxt 3 (Vue 3 + Nitro API), Postgres, GA4 Data API, Chart.js. Деплой — Vercel.

## Що вміє

- **Вхід** за логіном і паролем, без реєстрації. Паролі зберігаються як хеш (scrypt), сесія — у підписаному cookie. Є захист від перебору: 10 невдалих спроб за 15 хвилин.
- **Ролі.** Адмін бачить усі лендинги, створює й видаляє користувачів і лендинги та видає доступи. Користувач бачить лише призначені йому лендинги; сервер перевіряє доступ на кожен запит.
- **Дашборд:**
  - KPI: Sessions, Leads, Avg. Session Duration, Avg. Session Duration for Leads, Bounce rate. Для кожного — % зміни до попереднього періоду такої самої довжини і спарклайн по днях.
  - Ліди: Leads by Source (кругова), by Device, by Channel, Daily, Monthly.
  - Сесії: Sessions by Device, by Channel, Daily, Monthly.
  - Таблиці: Referrers Stats, Source, Source + Campaign — із загальним підсумком, сортуванням і пагінацією.
- **Адаптивна верстка**, світла й темна тема за системними налаштуваннями.

## Звідки беруться цифри

Використовується **GA4 Data API** з сервісного акаунта. Це те саме джерело, що й конектор GA4 у Looker Studio, тому цифри збігаються з GA4. BigQuery-експорт не потрібен.

| На дашборді | Що запитується в GA4 |
|---|---|
| Лендинг | фільтр `hostName = <домен лендингу>` |
| Sessions, Avg. Session Duration, Bounce rate | `sessions`, `averageSessionDuration`, `bounceRate` |
| Leads | `eventCount`, де `eventName = generate_lead` |
| Avg. Session Duration for Leads | `averageSessionDuration` сесій із подією ліда |
| Device / Channel | `deviceCategory` / `sessionDefaultChannelGroup` |
| UTM_Source / UTM_Campaign | `sessionSource` / `sessionCampaignName` |
| Page referrer | `pageReferrer` |
| Event count у таблицях | `eventCount` (усі події) |

Відповіді GA4 кешуються на 10 хвилин (`NUXT_GA4_CACHE_TTL`). Один перегляд дашборда — це 3 batch-запити (14 звітів); квот GA4 Data API для такого навантаження вистачає з запасом.

## Налаштування GA4

1. **Сервісний акаунт.** У Google Cloud Console створіть проєкт (або візьміть наявний), увімкніть **Google Analytics Data API**, створіть **Service Account** і завантажте JSON-ключ.
2. **Доступ до ресурсу.** У GA4 відкрийте *Admin → Property access management* і додайте email сервісного акаунта з роллю **Viewer**.
3. **Змінні.** `NUXT_GA4_PROPERTY_ID` — числовий ID ресурсу (*Admin → Property details*). `NUXT_GA4_CLIENT_EMAIL` і `NUXT_GA4_PRIVATE_KEY` беруться з JSON-ключа (поля `client_email` і `private_key`).

## Локальний запуск

```bash
npm install
cp .env.example .env    # заповніть NUXT_SESSION_PASSWORD і NUXT_ADMIN_PASSWORD
npm run dev             # http://localhost:3000
```

- **Без `NUXT_DATABASE_URL`** використовується вбудований Postgres (PGlite) у папці `.data/`.
- **З `NUXT_GA4_MOCK=1`** показуються демо-цифри, щоб працювати з інтерфейсом без доступу до GA4.

## Деплой на Vercel

1. **Імпорт.** Імпортуйте репозиторій у Vercel: Nuxt визначиться автоматично.
2. **База.** Створіть Postgres (Vercel Storage → Neon або будь-який інший) і задайте `NUXT_DATABASE_URL`. Таблиці створюються самі при першому запиті.
3. **Змінні.** Задайте решту змінних із `.env.example`: `NUXT_SESSION_PASSWORD`, `NUXT_ADMIN_LOGIN`, `NUXT_ADMIN_PASSWORD`, `NUXT_GA4_*`. `NUXT_GA4_MOCK` не задавайте.
4. **Перший вхід.** Після деплою увійдіть під адміном. Перший адмін створюється з env, лише поки таблиця користувачів порожня. Потім змініть йому пароль в адмінці.
5. **Наповнення.** В адмінці на вкладці «Лендинги» додайте лендинги: кнопка «Підтягнути домени з GA4» покаже hostname з даними за 90 днів. Далі на вкладці «Користувачі» заведіть користувачів і поставте галочки лендингів.

## Структура

```
server/api/auth/        вхід і вихід
server/api/landings     лендинги, доступні поточному користувачу
server/api/stats        дані дашборда (перевірка доступу → GA4)
server/api/admin/       користувачі, лендинги, домени з GA4
server/utils/ga4.ts     запити до GA4 і збирання відповіді
server/utils/db.ts      Postgres / PGlite, схема, перший адмін
pages/                  login, дашборд, адмінка
components/             KPI-картка, графіки, таблиця
```
