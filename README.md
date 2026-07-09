# AttendX — نظام إدارة الحضور
**Production-ready deployment for Render.com**

## البنية
```
attendx/
├── client/    ← React + Vite frontend
├── server/    ← Express.js backend
├── db/        ← Drizzle ORM schema
├── package.json
├── drizzle.config.js
└── render.yaml
```

## النشر على Render
1. Build Command: `npm install && npm run build`
2. Start Command: `npm start`
3. أنشئ PostgreSQL DB على Render وضع رابطه في `DATABASE_URL`
4. أضف باقي المتغيرات من `.env.example`
5. بعد أول نشر، من Render Shell: `npm run db:push`
