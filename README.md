# fetchathon3

Operations dashboard for Fetchathon 3 registrations. It reads the Notion roster directly. It does not call the registration agent.

## Run

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env`, add Notion keys, admin login, and SMTP settings, then open [http://localhost:3000](http://localhost:3000). Anyone with the link can view. Only the admin account can send RSVP seat confirmations or team venue QR emails. Bulk send is sequential over Gmail SMTP.

## Connect Notion later

Copy `.env.example` to `.env.local` and add:

- `NOTION_TOKEN`
- `NOTION_DATABASE_ID`

Optional RSVP Status and QR Status columns can be written back if they exist. SMTP sends from `Fetch-A-Thon` using the same banner and layout as the registration agent mailer. RSVP is a seat confirmation. QR is one venue code per team.

## Screens

- Overview: counts and graphs by location, city, builder type, and college
- Registrations: all Notion fields, open filters, row detail
- Teams: completeness and member lists
- RSVP & QR: send seat confirmation first, generate one QR per team, then email that QR for venue check-in
