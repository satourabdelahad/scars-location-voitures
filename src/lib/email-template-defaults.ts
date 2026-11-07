import type { TemplateKey } from "./email-template-defs";

type Tpl = { subject: string; html: string };
type Lang = "fr" | "ary" | "ar" | "en" | "es" | "de" | "ja" | "zh" | "ko";

/** Paragraphe aligné à droite pour l'arabe et la darija (les clients email n'appliquent pas toujours dir="rtl"). */
const rtl = (html: string) => html.replace(/<(h2|p|ul)>/g, '<$1 style="text-align:right" dir="rtl">');

type BaseKey = "manager_invite" | "car_created" | "reservation_created";
const T: Record<Lang, Record<BaseKey, Tpl>> = {
  fr: {
    manager_invite: {
      subject: "Bienvenue chez {{site}}, {{prenom}} : activez votre compte",
      html: `<h2>Bonjour {{civilite}} {{prenom}} {{nom}},</h2>
<p>Vous rejoignez l'équipe <strong>{{site}}</strong> en tant que gestionnaire à {{ville}} (contrat {{type_contrat}}, à partir du {{date_debut}}).</p>
<p>Pour accéder à votre espace, choisissez votre mot de passe avec le bouton ci-dessous. Ce lien est valable 7 jours.</p>
<p>{{bouton_invitation}}</p>
<p>Votre identifiant de connexion : <strong>{{email}}</strong></p>
<p>À très vite,<br>L'équipe {{site}}</p>`,
    },
    car_created: {
      subject: "Nouvelle voiture au parc : {{marque}} {{modele}} ({{immatriculation}})",
      html: `<h2>Une nouvelle voiture rejoint le parc</h2>
<p><strong>{{marque}} {{modele}}</strong> ({{annee}}), {{carrosserie}}, {{motorisation}}, boîte {{transmission}}.</p>
<ul><li>Immatriculation : {{immatriculation}}</li><li>Couleur : {{couleur}}</li><li>Prix par jour : {{prix_jour}}</li><li>Agence : {{agence}}</li><li>Gestionnaires : {{gestionnaires}}</li></ul>
<p>Ajoutée par {{ajoute_par}}.</p>
<p>{{bouton_voiture}}</p>`,
    },
    reservation_created: {
      subject: "Réservation {{reference}} : {{marque}} {{modele}} du {{date_debut}} au {{date_fin}}",
      html: `<h2>Bonjour {{destinataire}},</h2>
<p>Nous avons bien reçu la demande de réservation <strong>{{reference}}</strong>. Elle sera confirmée par notre équipe dans les plus brefs délais.</p>
<ul><li>Voiture : {{marque}} {{modele}} ({{annee}}), {{carrosserie}}, {{transmission}}</li><li>Dates : du {{date_debut}} au {{date_fin}} ({{jours}} jours)</li><li>Départ : {{agence_depart}} · Retour : {{agence_retour}}</li><li>Prix par jour : {{prix_jour}} · Options : {{options}}</li><li>Remise : {{remise}} {{code_promo}}</li><li><strong>Total : {{total}}</strong> (caution : {{caution}})</li></ul>
<p>Conducteur : {{client_nom}}, {{client_telephone}}</p>
<p>{{bouton_reservation}}</p>
<p>Merci de votre confiance,<br>L'équipe {{site}}</p>`,
    },
  },
  en: {
    manager_invite: {
      subject: "Welcome to {{site}}, {{prenom}}: activate your account",
      html: `<h2>Hello {{prenom}} {{nom}},</h2>
<p>You are joining the <strong>{{site}}</strong> team as a manager in {{ville}} ({{type_contrat}} contract, starting {{date_debut}}).</p>
<p>To access your area, choose your password with the button below. This link is valid for 7 days.</p>
<p>{{bouton_invitation}}</p>
<p>Your sign-in email: <strong>{{email}}</strong></p>
<p>See you soon,<br>The {{site}} team</p>`,
    },
    car_created: {
      subject: "New car in the fleet: {{marque}} {{modele}} ({{immatriculation}})",
      html: `<h2>A new car joins the fleet</h2>
<p><strong>{{marque}} {{modele}}</strong> ({{annee}}), {{carrosserie}}, {{motorisation}}, {{transmission}} gearbox.</p>
<ul><li>Plate: {{immatriculation}}</li><li>Colour: {{couleur}}</li><li>Price per day: {{prix_jour}}</li><li>Branch: {{agence}}</li><li>Managers: {{gestionnaires}}</li></ul>
<p>Added by {{ajoute_par}}.</p>
<p>{{bouton_voiture}}</p>`,
    },
    reservation_created: {
      subject: "Booking {{reference}}: {{marque}} {{modele}} from {{date_debut}} to {{date_fin}}",
      html: `<h2>Hello {{destinataire}},</h2>
<p>We have received booking request <strong>{{reference}}</strong>. Our team will confirm it shortly.</p>
<ul><li>Car: {{marque}} {{modele}} ({{annee}}), {{carrosserie}}, {{transmission}}</li><li>Dates: {{date_debut}} to {{date_fin}} ({{jours}} days)</li><li>Pick-up: {{agence_depart}} · Return: {{agence_retour}}</li><li>Price per day: {{prix_jour}} · Extras: {{options}}</li><li>Discount: {{remise}} {{code_promo}}</li><li><strong>Total: {{total}}</strong> (deposit: {{caution}})</li></ul>
<p>Driver: {{client_nom}}, {{client_telephone}}</p>
<p>{{bouton_reservation}}</p>
<p>Thank you for your trust,<br>The {{site}} team</p>`,
    },
  },
  es: {
    manager_invite: {
      subject: "Bienvenido a {{site}}, {{prenom}}: active su cuenta",
      html: `<h2>Hola {{prenom}} {{nom}}:</h2>
<p>Se une al equipo de <strong>{{site}}</strong> como gestor en {{ville}} (contrato {{type_contrat}}, a partir del {{date_debut}}).</p>
<p>Para acceder a su espacio, elija su contraseña con el botón de abajo. El enlace es válido durante 7 días.</p>
<p>{{bouton_invitation}}</p>
<p>Su email de acceso: <strong>{{email}}</strong></p>
<p>Hasta pronto,<br>El equipo de {{site}}</p>`,
    },
    car_created: {
      subject: "Nuevo coche en la flota: {{marque}} {{modele}} ({{immatriculation}})",
      html: `<h2>Un nuevo coche se incorpora a la flota</h2>
<p><strong>{{marque}} {{modele}}</strong> ({{annee}}), {{carrosserie}}, {{motorisation}}, cambio {{transmission}}.</p>
<ul><li>Matrícula: {{immatriculation}}</li><li>Color: {{couleur}}</li><li>Precio por día: {{prix_jour}}</li><li>Agencia: {{agence}}</li><li>Gestores: {{gestionnaires}}</li></ul>
<p>Añadido por {{ajoute_par}}.</p>
<p>{{bouton_voiture}}</p>`,
    },
    reservation_created: {
      subject: "Reserva {{reference}}: {{marque}} {{modele}} del {{date_debut}} al {{date_fin}}",
      html: `<h2>Hola {{destinataire}}:</h2>
<p>Hemos recibido la solicitud de reserva <strong>{{reference}}</strong>. Nuestro equipo la confirmará en breve.</p>
<ul><li>Coche: {{marque}} {{modele}} ({{annee}}), {{carrosserie}}, {{transmission}}</li><li>Fechas: del {{date_debut}} al {{date_fin}} ({{jours}} días)</li><li>Entrega: {{agence_depart}} · Devolución: {{agence_retour}}</li><li>Precio por día: {{prix_jour}} · Opciones: {{options}}</li><li>Descuento: {{remise}} {{code_promo}}</li><li><strong>Total: {{total}}</strong> (fianza: {{caution}})</li></ul>
<p>Conductor: {{client_nom}}, {{client_telephone}}</p>
<p>{{bouton_reservation}}</p>
<p>Gracias por su confianza,<br>El equipo de {{site}}</p>`,
    },
  },
  de: {
    manager_invite: {
      subject: "Willkommen bei {{site}}, {{prenom}}: Konto aktivieren",
      html: `<h2>Hallo {{prenom}} {{nom}},</h2>
<p>Sie verstärken das Team von <strong>{{site}}</strong> als Verwalter in {{ville}} (Vertrag {{type_contrat}}, ab {{date_debut}}).</p>
<p>Wählen Sie über die Schaltfläche unten Ihr Passwort, um Ihren Bereich zu öffnen. Der Link ist 7 Tage gültig.</p>
<p>{{bouton_invitation}}</p>
<p>Ihre Anmelde-E-Mail: <strong>{{email}}</strong></p>
<p>Bis bald,<br>Ihr {{site}}-Team</p>`,
    },
    car_created: {
      subject: "Neues Auto in der Flotte: {{marque}} {{modele}} ({{immatriculation}})",
      html: `<h2>Ein neues Auto ist in der Flotte</h2>
<p><strong>{{marque}} {{modele}}</strong> ({{annee}}), {{carrosserie}}, {{motorisation}}, Getriebe {{transmission}}.</p>
<ul><li>Kennzeichen: {{immatriculation}}</li><li>Farbe: {{couleur}}</li><li>Preis pro Tag: {{prix_jour}}</li><li>Filiale: {{agence}}</li><li>Verwalter: {{gestionnaires}}</li></ul>
<p>Hinzugefügt von {{ajoute_par}}.</p>
<p>{{bouton_voiture}}</p>`,
    },
    reservation_created: {
      subject: "Buchung {{reference}}: {{marque}} {{modele}} vom {{date_debut}} bis {{date_fin}}",
      html: `<h2>Hallo {{destinataire}},</h2>
<p>Wir haben die Buchungsanfrage <strong>{{reference}}</strong> erhalten. Unser Team bestätigt sie in Kürze.</p>
<ul><li>Auto: {{marque}} {{modele}} ({{annee}}), {{carrosserie}}, {{transmission}}</li><li>Zeitraum: {{date_debut}} bis {{date_fin}} ({{jours}} Tage)</li><li>Abholung: {{agence_depart}} · Rückgabe: {{agence_retour}}</li><li>Preis pro Tag: {{prix_jour}} · Extras: {{options}}</li><li>Rabatt: {{remise}} {{code_promo}}</li><li><strong>Gesamt: {{total}}</strong> (Kaution: {{caution}})</li></ul>
<p>Fahrer: {{client_nom}}, {{client_telephone}}</p>
<p>{{bouton_reservation}}</p>
<p>Vielen Dank für Ihr Vertrauen,<br>Ihr {{site}}-Team</p>`,
    },
  },
  ar: {
    manager_invite: {
      subject: "مرحبًا بك في {{site}} يا {{prenom}}: فعّل حسابك",
      html: rtl(`<h2>مرحبًا {{prenom}} {{nom}}،</h2>
<p>تنضم إلى فريق <strong>{{site}}</strong> مسيّرًا في {{ville}} (عقد {{type_contrat}}، ابتداءً من {{date_debut}}).</p>
<p>للدخول إلى فضائك، اختر كلمة المرور عبر الزر أدناه. الرابط صالح لمدة 7 أيام.</p>
<p>{{bouton_invitation}}</p>
<p>بريد الدخول: <strong>{{email}}</strong></p>
<p>إلى اللقاء،<br>فريق {{site}}</p>`),
    },
    car_created: {
      subject: "سيارة جديدة في الأسطول: {{marque}} {{modele}} ({{immatriculation}})",
      html: rtl(`<h2>سيارة جديدة تنضم إلى الأسطول</h2>
<p><strong>{{marque}} {{modele}}</strong> ({{annee}})، {{carrosserie}}، {{motorisation}}، ناقل حركة {{transmission}}.</p>
<ul><li>رقم التسجيل: {{immatriculation}}</li><li>اللون: {{couleur}}</li><li>السعر اليومي: {{prix_jour}}</li><li>الوكالة: {{agence}}</li><li>المسيّرون: {{gestionnaires}}</li></ul>
<p>أضافها {{ajoute_par}}.</p>
<p>{{bouton_voiture}}</p>`),
    },
    reservation_created: {
      subject: "الحجز {{reference}}: {{marque}} {{modele}} من {{date_debut}} إلى {{date_fin}}",
      html: rtl(`<h2>مرحبًا {{destinataire}}،</h2>
<p>توصلنا بطلب الحجز <strong>{{reference}}</strong>. سيؤكده فريقنا في أقرب وقت.</p>
<ul><li>السيارة: {{marque}} {{modele}} ({{annee}})، {{carrosserie}}، {{transmission}}</li><li>التواريخ: من {{date_debut}} إلى {{date_fin}} ({{jours}} أيام)</li><li>الانطلاق: {{agence_depart}} · الإرجاع: {{agence_retour}}</li><li>السعر اليومي: {{prix_jour}} · الخيارات: {{options}}</li><li>الخصم: {{remise}} {{code_promo}}</li><li><strong>المجموع: {{total}}</strong> (الضمان: {{caution}})</li></ul>
<p>السائق: {{client_nom}}، {{client_telephone}}</p>
<p>{{bouton_reservation}}</p>
<p>شكرًا على ثقتك،<br>فريق {{site}}</p>`),
    },
  },
  ary: {
    manager_invite: {
      subject: "مرحبا بيك فـ {{site}} آ {{prenom}}: شعّل الحساب ديالك",
      html: rtl(`<h2>السلام {{prenom}} {{nom}}،</h2>
<p>غادي تخدم مع الفريق ديال <strong>{{site}}</strong> كمسير فـ {{ville}} (كونترا {{type_contrat}}، من {{date_debut}}).</p>
<p>باش تدخل للفضاء ديالك، ختار كلمة السر بالبوطونة اللي لتحت. الرابط صالح 7 أيام.</p>
<p>{{bouton_invitation}}</p>
<p>الإيميل ديال الدخول: <strong>{{email}}</strong></p>
<p>نتلاقاو قريب،<br>الفريق ديال {{site}}</p>`),
    },
    car_created: {
      subject: "طوموبيل جديدة فالباركينغ: {{marque}} {{modele}} ({{immatriculation}})",
      html: rtl(`<h2>طوموبيل جديدة تزادت</h2>
<p><strong>{{marque}} {{modele}}</strong> ({{annee}})، {{carrosserie}}، {{motorisation}}، فيتيس {{transmission}}.</p>
<ul><li>الماتريكول: {{immatriculation}}</li><li>اللون: {{couleur}}</li><li>الثمن فالنهار: {{prix_jour}}</li><li>الوكالة: {{agence}}</li><li>المسيرين: {{gestionnaires}}</li></ul>
<p>زادها {{ajoute_par}}.</p>
<p>{{bouton_voiture}}</p>`),
    },
    reservation_created: {
      subject: "الحجز {{reference}}: {{marque}} {{modele}} من {{date_debut}} حتى {{date_fin}}",
      html: rtl(`<h2>السلام {{destinataire}}،</h2>
<p>وصلنا طلب الحجز <strong>{{reference}}</strong>. الفريق ديالنا غادي يأكدو قريب.</p>
<ul><li>الطوموبيل: {{marque}} {{modele}} ({{annee}})، {{carrosserie}}، {{transmission}}</li><li>التواريخ: من {{date_debut}} حتى {{date_fin}} ({{jours}} أيام)</li><li>الخروج: {{agence_depart}} · الرجوع: {{agence_retour}}</li><li>الثمن فالنهار: {{prix_jour}} · الأوبسيونات: {{options}}</li><li>التخفيض: {{remise}} {{code_promo}}</li><li><strong>المجموع: {{total}}</strong> (الضمانة: {{caution}})</li></ul>
<p>الشيفور: {{client_nom}}، {{client_telephone}}</p>
<p>{{bouton_reservation}}</p>
<p>شكرا على الثقة ديالك،<br>الفريق ديال {{site}}</p>`),
    },
  },
  ja: {
    manager_invite: {
      subject: "{{site}} へようこそ、{{prenom}} さん：アカウントを有効にしてください",
      html: `<h2>{{nom}} {{prenom}} 様</h2>
<p>{{ville}} のマネージャーとして <strong>{{site}}</strong> のチームに加わっていただきます（{{type_contrat}}、{{date_debut}} から）。</p>
<p>下のボタンからパスワードを設定して、専用ページにアクセスしてください。リンクの有効期限は7日間です。</p>
<p>{{bouton_invitation}}</p>
<p>ログイン用メール：<strong>{{email}}</strong></p>
<p>{{site}} チーム</p>`,
    },
    car_created: {
      subject: "新しい車両が追加されました：{{marque}} {{modele}}（{{immatriculation}}）",
      html: `<h2>新しい車両が加わりました</h2>
<p><strong>{{marque}} {{modele}}</strong>（{{annee}}年）、{{carrosserie}}、{{motorisation}}、{{transmission}}。</p>
<ul><li>ナンバー：{{immatriculation}}</li><li>色：{{couleur}}</li><li>1日料金：{{prix_jour}}</li><li>店舗：{{agence}}</li><li>担当マネージャー：{{gestionnaires}}</li></ul>
<p>追加した人：{{ajoute_par}}</p>
<p>{{bouton_voiture}}</p>`,
    },
    reservation_created: {
      subject: "ご予約 {{reference}}：{{marque}} {{modele}}（{{date_debut}}〜{{date_fin}}）",
      html: `<h2>{{destinataire}} 様</h2>
<p>ご予約リクエスト <strong>{{reference}}</strong> を受け付けました。まもなくスタッフが確定いたします。</p>
<ul><li>車両：{{marque}} {{modele}}（{{annee}}年）、{{carrosserie}}、{{transmission}}</li><li>期間：{{date_debut}}〜{{date_fin}}（{{jours}}日間）</li><li>貸出：{{agence_depart}} · 返却：{{agence_retour}}</li><li>1日料金：{{prix_jour}} · オプション：{{options}}</li><li>割引：{{remise}} {{code_promo}}</li><li><strong>合計：{{total}}</strong>（保証金：{{caution}}）</li></ul>
<p>運転者：{{client_nom}}、{{client_telephone}}</p>
<p>{{bouton_reservation}}</p>
<p>{{site}} チーム</p>`,
    },
  },
  zh: {
    manager_invite: {
      subject: "欢迎加入 {{site}}，{{prenom}}：请激活您的账户",
      html: `<h2>{{nom}}{{prenom}}，您好：</h2>
<p>您将以经理身份加入 <strong>{{site}}</strong> 团队，工作城市：{{ville}}（{{type_contrat}}，自 {{date_debut}} 起）。</p>
<p>请点击下方按钮设置密码以进入您的空间。链接 7 天内有效。</p>
<p>{{bouton_invitation}}</p>
<p>登录邮箱：<strong>{{email}}</strong></p>
<p>{{site}} 团队</p>`,
    },
    car_created: {
      subject: "车队新增车辆：{{marque}} {{modele}}（{{immatriculation}}）",
      html: `<h2>一辆新车加入车队</h2>
<p><strong>{{marque}} {{modele}}</strong>（{{annee}}），{{carrosserie}}，{{motorisation}}，{{transmission}}。</p>
<ul><li>车牌号：{{immatriculation}}</li><li>颜色：{{couleur}}</li><li>日租价格：{{prix_jour}}</li><li>门店：{{agence}}</li><li>负责经理：{{gestionnaires}}</li></ul>
<p>添加人：{{ajoute_par}}</p>
<p>{{bouton_voiture}}</p>`,
    },
    reservation_created: {
      subject: "预订 {{reference}}：{{marque}} {{modele}}，{{date_debut}} 至 {{date_fin}}",
      html: `<h2>{{destinataire}}，您好：</h2>
<p>我们已收到预订申请 <strong>{{reference}}</strong>，团队将尽快为您确认。</p>
<ul><li>车辆：{{marque}} {{modele}}（{{annee}}），{{carrosserie}}，{{transmission}}</li><li>日期：{{date_debut}} 至 {{date_fin}}（{{jours}} 天）</li><li>取车：{{agence_depart}} · 还车：{{agence_retour}}</li><li>日租价格：{{prix_jour}} · 附加选项：{{options}}</li><li>折扣：{{remise}} {{code_promo}}</li><li><strong>总价：{{total}}</strong>（押金：{{caution}}）</li></ul>
<p>驾驶人：{{client_nom}}，{{client_telephone}}</p>
<p>{{bouton_reservation}}</p>
<p>感谢您的信任，<br>{{site}} 团队</p>`,
    },
  },
  ko: {
    manager_invite: {
      subject: "{{site}}에 오신 것을 환영합니다, {{prenom}} 님: 계정을 활성화하세요",
      html: `<h2>{{nom}}{{prenom}} 님, 안녕하세요.</h2>
<p>{{ville}} 매니저로 <strong>{{site}}</strong> 팀에 합류하게 되었습니다({{type_contrat}}, {{date_debut}}부터).</p>
<p>아래 버튼으로 비밀번호를 설정하고 전용 공간에 접속하세요. 링크는 7일 동안 유효합니다.</p>
<p>{{bouton_invitation}}</p>
<p>로그인 이메일: <strong>{{email}}</strong></p>
<p>{{site}} 팀 드림</p>`,
    },
    car_created: {
      subject: "새 차량 추가: {{marque}} {{modele}} ({{immatriculation}})",
      html: `<h2>새 차량이 추가되었습니다</h2>
<p><strong>{{marque}} {{modele}}</strong> ({{annee}}), {{carrosserie}}, {{motorisation}}, {{transmission}}.</p>
<ul><li>번호판: {{immatriculation}}</li><li>색상: {{couleur}}</li><li>1일 요금: {{prix_jour}}</li><li>지점: {{agence}}</li><li>담당 매니저: {{gestionnaires}}</li></ul>
<p>추가한 사람: {{ajoute_par}}</p>
<p>{{bouton_voiture}}</p>`,
    },
    reservation_created: {
      subject: "예약 {{reference}}: {{marque}} {{modele}}, {{date_debut}} ~ {{date_fin}}",
      html: `<h2>{{destinataire}} 님, 안녕하세요.</h2>
<p>예약 요청 <strong>{{reference}}</strong>을(를) 받았습니다. 곧 담당자가 확정해 드립니다.</p>
<ul><li>차량: {{marque}} {{modele}} ({{annee}}), {{carrosserie}}, {{transmission}}</li><li>기간: {{date_debut}} ~ {{date_fin}} ({{jours}}일)</li><li>출고: {{agence_depart}} · 반납: {{agence_retour}}</li><li>1일 요금: {{prix_jour}} · 옵션: {{options}}</li><li>할인: {{remise}} {{code_promo}}</li><li><strong>합계: {{total}}</strong> (보증금: {{caution}})</li></ul>
<p>운전자: {{client_nom}}, {{client_telephone}}</p>
<p>{{bouton_reservation}}</p>
<p>감사합니다.<br>{{site}} 팀</p>`,
    },
  },
};


/** Invitation d'un client ajouté par l'équipe, et suivi d'un prospect envoyé au client. */
const T2: Record<Lang, Record<Exclude<TemplateKey, BaseKey | Key3>, Tpl>> = {
  fr: {
    manager_password_set: {
      subject: "Votre mot de passe {{site}} a été changé",
      html: `<h2>Bonjour {{civilite}} {{prenom}} {{nom}},</h2>
<p>{{modifie_par}} vient de changer le mot de passe de votre compte <strong>{{site}}</strong>.</p>
<p>Identifiant : <strong>{{email}}</strong><br>Nouveau mot de passe : <strong>{{mot_de_passe}}</strong></p>
<p>{{bouton_connexion}}</p>
<p>Pour votre sécurité, choisissez un mot de passe personnel dès votre connexion, dans « Mon profil » → « Mot de passe », et supprimez cet email.</p>
<p>L'équipe {{site}}</p>`,
    },
    client_invite: {
      subject: "{{prenom}}, votre espace client {{site}} vous attend",
      html: `<h2>Bonjour {{civilite}} {{prenom}} {{nom}},</h2>
<p>{{ajoute_par}} vient de créer votre fiche client chez <strong>{{site}}</strong>.</p>
<p>Avec le bouton ci-dessous, choisissez votre mot de passe puis vérifiez et complétez vos informations (téléphone, ville, permis…). Vous pourrez ensuite réserver en quelques clics et suivre vos locations. Ce lien est valable 7 jours.</p>
<p>{{bouton_invitation}}</p>
<p>Votre identifiant de connexion : <strong>{{email}}</strong></p>
<p>À très vite,<br>L'équipe {{site}}</p>`,
    },
    prospect_followup: {
      subject: "Suite à notre échange du {{date}} : {{site}}",
      html: `<h2>Bonjour {{prenom}} {{nom}},</h2>
<p>Merci pour notre échange du {{date}} à {{heure}} ({{type_prospection}}).</p>
<p>{{note}}</p>
<p><strong>Prochaine étape :</strong> {{prochaine_action}}</p>
<p>{{bouton_site}}</p>
<p>Je reste à votre disposition : {{gestionnaire_telephone}} · {{gestionnaire_email}}</p>
<p>Cordialement,<br>{{gestionnaire}}, {{site}}</p>`,
    },
  },
  en: {
    manager_password_set: {
      subject: "Your {{site}} password has been changed",
      html: `<h2>Hello {{prenom}} {{nom}},</h2>
<p>{{modifie_par}} has just changed the password of your <strong>{{site}}</strong> account.</p>
<p>Sign-in email: <strong>{{email}}</strong><br>New password: <strong>{{mot_de_passe}}</strong></p>
<p>{{bouton_connexion}}</p>
<p>For your security, choose your own password as soon as you sign in, in “My profile” → “Password”, and delete this email.</p>
<p>The {{site}} team</p>`,
    },
    client_invite: {
      subject: "{{prenom}}, your {{site}} customer account is ready",
      html: `<h2>Hello {{prenom}} {{nom}},</h2>
<p>{{ajoute_par}} has just created your customer profile at <strong>{{site}}</strong>.</p>
<p>Use the button below to choose your password, then check and complete your details (phone, city, driving licence…). You can then book in a few clicks and follow your rentals. This link is valid for 7 days.</p>
<p>{{bouton_invitation}}</p>
<p>Your sign-in email: <strong>{{email}}</strong></p>
<p>See you soon,<br>The {{site}} team</p>`,
    },
    prospect_followup: {
      subject: "Following our conversation on {{date}}: {{site}}",
      html: `<h2>Hello {{prenom}} {{nom}},</h2>
<p>Thank you for our conversation on {{date}} at {{heure}} ({{type_prospection}}).</p>
<p>{{note}}</p>
<p><strong>Next step:</strong> {{prochaine_action}}</p>
<p>{{bouton_site}}</p>
<p>I remain at your disposal: {{gestionnaire_telephone}} · {{gestionnaire_email}}</p>
<p>Best regards,<br>{{gestionnaire}}, {{site}}</p>`,
    },
  },
  es: {
    manager_password_set: {
      subject: "Tu contraseña de {{site}} ha cambiado",
      html: `<h2>Hola {{prenom}} {{nom}}:</h2>
<p>{{modifie_par}} acaba de cambiar la contraseña de tu cuenta de <strong>{{site}}</strong>.</p>
<p>Correo de acceso: <strong>{{email}}</strong><br>Nueva contraseña: <strong>{{mot_de_passe}}</strong></p>
<p>{{bouton_connexion}}</p>
<p>Por tu seguridad, elige tu propia contraseña al iniciar sesión, en «Mi perfil» → «Contraseña», y elimina este correo.</p>
<p>El equipo de {{site}}</p>`,
    },
    client_invite: {
      subject: "{{prenom}}, tu área de cliente de {{site}} te espera",
      html: `<h2>Hola {{prenom}} {{nom}}:</h2>
<p>{{ajoute_par}} acaba de crear tu ficha de cliente en <strong>{{site}}</strong>.</p>
<p>Con el botón de abajo, elige tu contraseña y después revisa y completa tus datos (teléfono, ciudad, permiso de conducir…). Así podrás reservar en pocos clics y seguir tus alquileres. Este enlace es válido durante 7 días.</p>
<p>{{bouton_invitation}}</p>
<p>Tu correo de acceso: <strong>{{email}}</strong></p>
<p>¡Hasta pronto!<br>El equipo de {{site}}</p>`,
    },
    prospect_followup: {
      subject: "Tras nuestra conversación del {{date}}: {{site}}",
      html: `<h2>Hola {{prenom}} {{nom}}:</h2>
<p>Gracias por nuestra conversación del {{date}} a las {{heure}} ({{type_prospection}}).</p>
<p>{{note}}</p>
<p><strong>Próximo paso:</strong> {{prochaine_action}}</p>
<p>{{bouton_site}}</p>
<p>Quedo a tu disposición: {{gestionnaire_telephone}} · {{gestionnaire_email}}</p>
<p>Un saludo,<br>{{gestionnaire}}, {{site}}</p>`,
    },
  },
  de: {
    manager_password_set: {
      subject: "Ihr {{site}}-Passwort wurde geändert",
      html: `<h2>Guten Tag {{prenom}} {{nom}},</h2>
<p>{{modifie_par}} hat soeben das Passwort Ihres <strong>{{site}}</strong>-Kontos geändert.</p>
<p>Anmelde-E-Mail: <strong>{{email}}</strong><br>Neues Passwort: <strong>{{mot_de_passe}}</strong></p>
<p>{{bouton_connexion}}</p>
<p>Wählen Sie zu Ihrer Sicherheit nach der Anmeldung unter „Mein Profil“ → „Passwort“ ein eigenes Passwort und löschen Sie diese E-Mail.</p>
<p>Ihr {{site}}-Team</p>`,
    },
    client_invite: {
      subject: "{{prenom}}, Ihr Kundenkonto bei {{site}} ist bereit",
      html: `<h2>Guten Tag {{prenom}} {{nom}},</h2>
<p>{{ajoute_par}} hat soeben Ihr Kundenprofil bei <strong>{{site}}</strong> angelegt.</p>
<p>Wählen Sie über die Schaltfläche unten Ihr Passwort und prüfen und ergänzen Sie anschließend Ihre Angaben (Telefon, Stadt, Führerschein…). Danach buchen Sie mit wenigen Klicks und behalten Ihre Mieten im Blick. Der Link ist 7 Tage gültig.</p>
<p>{{bouton_invitation}}</p>
<p>Ihre Anmelde-E-Mail: <strong>{{email}}</strong></p>
<p>Bis bald,<br>Ihr {{site}}-Team</p>`,
    },
    prospect_followup: {
      subject: "Im Anschluss an unser Gespräch vom {{date}}: {{site}}",
      html: `<h2>Guten Tag {{prenom}} {{nom}},</h2>
<p>Vielen Dank für unser Gespräch am {{date}} um {{heure}} ({{type_prospection}}).</p>
<p>{{note}}</p>
<p><strong>Nächster Schritt:</strong> {{prochaine_action}}</p>
<p>{{bouton_site}}</p>
<p>Ich stehe Ihnen gern zur Verfügung: {{gestionnaire_telephone}} · {{gestionnaire_email}}</p>
<p>Mit freundlichen Grüßen<br>{{gestionnaire}}, {{site}}</p>`,
    },
  },
  ar: {
    manager_password_set: {
      subject: "تم تغيير كلمة مرور حسابك في {{site}}",
      html: rtl(`<h2>مرحبًا {{prenom}} {{nom}}،</h2>
<p>قام {{modifie_par}} بتغيير كلمة مرور حسابك في <strong>{{site}}</strong>.</p>
<p>بريد الدخول: <strong>{{email}}</strong><br>كلمة المرور الجديدة: <strong>{{mot_de_passe}}</strong></p>
<p>{{bouton_connexion}}</p>
<p>حفاظًا على أمانك، اختر كلمة مرور خاصة بك فور تسجيل الدخول من «ملفي» ← «كلمة المرور»، واحذف هذا البريد.</p>
<p>فريق {{site}}</p>`),
    },
    client_invite: {
      subject: "{{prenom}}، فضاء العميل الخاص بك في {{site}} جاهز",
      html: rtl(`<h2>مرحبًا {{prenom}} {{nom}}،</h2>
<p>أنشأ {{ajoute_par}} ملفك كعميل لدى <strong>{{site}}</strong>.</p>
<p>اختر كلمة المرور عبر الزر أدناه، ثم راجع معلوماتك وأكملها (الهاتف، المدينة، رخصة السياقة…). بعد ذلك يمكنك الحجز ببضع نقرات ومتابعة كراءاتك. هذا الرابط صالح لمدة 7 أيام.</p>
<p>{{bouton_invitation}}</p>
<p>بريد تسجيل الدخول: <strong>{{email}}</strong></p>
<p>إلى اللقاء قريبًا،<br>فريق {{site}}</p>`),
    },
    prospect_followup: {
      subject: "متابعة لمحادثتنا بتاريخ {{date}}: {{site}}",
      html: rtl(`<h2>مرحبًا {{prenom}} {{nom}}،</h2>
<p>شكرًا على محادثتنا بتاريخ {{date}} على الساعة {{heure}} ({{type_prospection}}).</p>
<p>{{note}}</p>
<p><strong>الخطوة التالية:</strong> {{prochaine_action}}</p>
<p>{{bouton_site}}</p>
<p>أبقى رهن إشارتك: {{gestionnaire_telephone}} · {{gestionnaire_email}}</p>
<p>مع خالص التحية،<br>{{gestionnaire}}، {{site}}</p>`),
    },
  },
  ary: {
    manager_password_set: {
      subject: "كلمة السر ديالك ف {{site}} تبدّلات",
      html: rtl(`<h2>السلام {{prenom}} {{nom}}،</h2>
<p>{{modifie_par}} بدّل كلمة السر ديال الحساب ديالك ف <strong>{{site}}</strong>.</p>
<p>الإيميل باش تدخل: <strong>{{email}}</strong><br>كلمة السر الجديدة: <strong>{{mot_de_passe}}</strong></p>
<p>{{bouton_connexion}}</p>
<p>باش تبقى محمي، ختار كلمة سر ديالك منين تدخل، ف «البروفيل ديالي» ← «كلمة السر»، ومسح هاد الإيميل.</p>
<p>الفريق ديال {{site}}</p>`),
    },
    client_invite: {
      subject: "{{prenom}}، الفضاء ديالك ف {{site}} واجد",
      html: rtl(`<h2>السلام {{prenom}} {{nom}}،</h2>
<p>{{ajoute_par}} صاوب ليك الفيشة ديالك كزبون ف <strong>{{site}}</strong>.</p>
<p>ضغط على البوطونة لتحت باش تختار كلمة السر، ومن بعد شوف المعلومات ديالك وكملهم (التيليفون، المدينة، البيرمي…). من بعد تقدر تريزيرفي ف جوج كليكات وتتبع الكرا ديالك. هاد الليان صالح 7 أيام.</p>
<p>{{bouton_invitation}}</p>
<p>الإيميل باش تدخل: <strong>{{email}}</strong></p>
<p>نتلاقاو قريب،<br>الفريق ديال {{site}}</p>`),
    },
    prospect_followup: {
      subject: "من بعد الهضرة ديالنا نهار {{date}}: {{site}}",
      html: rtl(`<h2>السلام {{prenom}} {{nom}}،</h2>
<p>شكرا على الهضرة ديالنا نهار {{date}} مع {{heure}} ({{type_prospection}}).</p>
<p>{{note}}</p>
<p><strong>الخطوة الجاية:</strong> {{prochaine_action}}</p>
<p>{{bouton_site}}</p>
<p>أنا رهن الإشارة: {{gestionnaire_telephone}} · {{gestionnaire_email}}</p>
<p>بالتوفيق،<br>{{gestionnaire}}، {{site}}</p>`),
    },
  },
  ja: {
    manager_password_set: {
      subject: "{{site}}のパスワードが変更されました",
      html: `<h2>{{nom}} {{prenom}} 様</h2>
<p>{{modifie_par}}が<strong>{{site}}</strong>アカウントのパスワードを変更しました。</p>
<p>ログイン用メール：<strong>{{email}}</strong><br>新しいパスワード：<strong>{{mot_de_passe}}</strong></p>
<p>{{bouton_connexion}}</p>
<p>安全のため、ログイン後すぐに「プロフィール」→「パスワード」でご自身のパスワードに変更し、このメールを削除してください。</p>
<p>{{site}}チーム</p>`,
    },
    client_invite: {
      subject: "{{prenom}}様、{{site}}のお客様アカウントの準備ができました",
      html: `<h2>{{nom}} {{prenom}} 様</h2>
<p>{{ajoute_par}}が<strong>{{site}}</strong>にお客様情報を登録しました。</p>
<p>下のボタンからパスワードを設定し、ご登録内容（電話番号、都市、運転免許など）をご確認・ご入力ください。数クリックで予約でき、レンタル状況も確認できます。このリンクの有効期限は7日間です。</p>
<p>{{bouton_invitation}}</p>
<p>ログイン用メールアドレス：<strong>{{email}}</strong></p>
<p>{{site}}チーム</p>`,
    },
    prospect_followup: {
      subject: "{{date}}のご相談について：{{site}}",
      html: `<h2>{{nom}} {{prenom}} 様</h2>
<p>{{date}} {{heure}}のご相談（{{type_prospection}}）ありがとうございました。</p>
<p>{{note}}</p>
<p><strong>次のステップ：</strong>{{prochaine_action}}</p>
<p>{{bouton_site}}</p>
<p>ご不明な点はお気軽にご連絡ください：{{gestionnaire_telephone}} · {{gestionnaire_email}}</p>
<p>{{gestionnaire}}（{{site}}）</p>`,
    },
  },
  zh: {
    manager_password_set: {
      subject: "您的 {{site}} 密码已更改",
      html: `<h2>{{nom}}{{prenom}}，您好：</h2>
<p>{{modifie_par}} 刚刚更改了您 <strong>{{site}}</strong> 账户的密码。</p>
<p>登录邮箱：<strong>{{email}}</strong><br>新密码：<strong>{{mot_de_passe}}</strong></p>
<p>{{bouton_connexion}}</p>
<p>为了您的安全，请在登录后立即在“我的资料”→“密码”中设置您自己的密码，并删除此邮件。</p>
<p>{{site}} 团队</p>`,
    },
    client_invite: {
      subject: "{{prenom}}，您的 {{site}} 客户账户已准备就绪",
      html: `<h2>{{nom}}{{prenom}}，您好：</h2>
<p>{{ajoute_par}} 已在 <strong>{{site}}</strong> 为您创建客户资料。</p>
<p>请点击下方按钮设置密码，然后核对并补充您的信息（电话、城市、驾照等）。之后只需几步即可预订并查看您的租车记录。此链接 7 天内有效。</p>
<p>{{bouton_invitation}}</p>
<p>登录邮箱：<strong>{{email}}</strong></p>
<p>{{site}} 团队</p>`,
    },
    prospect_followup: {
      subject: "关于 {{date}} 的沟通：{{site}}",
      html: `<h2>{{nom}}{{prenom}}，您好：</h2>
<p>感谢您在 {{date}} {{heure}} 与我们沟通（{{type_prospection}}）。</p>
<p>{{note}}</p>
<p><strong>下一步：</strong>{{prochaine_action}}</p>
<p>{{bouton_site}}</p>
<p>如有任何问题，请随时联系我：{{gestionnaire_telephone}} · {{gestionnaire_email}}</p>
<p>此致<br>{{gestionnaire}}，{{site}}</p>`,
    },
  },
  ko: {
    manager_password_set: {
      subject: "{{site}} 비밀번호가 변경되었습니다",
      html: `<h2>{{nom}}{{prenom}} 님, 안녕하세요.</h2>
<p>{{modifie_par}} 님이 <strong>{{site}}</strong> 계정의 비밀번호를 변경했습니다.</p>
<p>로그인 이메일: <strong>{{email}}</strong><br>새 비밀번호: <strong>{{mot_de_passe}}</strong></p>
<p>{{bouton_connexion}}</p>
<p>보안을 위해 로그인 후 바로 “내 프로필” → “비밀번호”에서 직접 비밀번호를 설정하고 이 이메일을 삭제하세요.</p>
<p>{{site}} 팀 드림</p>`,
    },
    client_invite: {
      subject: "{{prenom}} 님, {{site}} 고객 계정이 준비되었습니다",
      html: `<h2>{{nom}}{{prenom}} 님, 안녕하세요.</h2>
<p>{{ajoute_par}} 님이 <strong>{{site}}</strong>에 고객 정보를 등록했습니다.</p>
<p>아래 버튼을 눌러 비밀번호를 설정한 뒤 정보(전화번호, 도시, 운전면허 등)를 확인하고 입력해 주세요. 이후 몇 번의 클릭으로 예약하고 렌트 내역을 확인할 수 있습니다. 이 링크는 7일 동안 유효합니다.</p>
<p>{{bouton_invitation}}</p>
<p>로그인 이메일: <strong>{{email}}</strong></p>
<p>{{site}} 팀 드림</p>`,
    },
    prospect_followup: {
      subject: "{{date}} 상담 관련 안내: {{site}}",
      html: `<h2>{{nom}}{{prenom}} 님, 안녕하세요.</h2>
<p>{{date}} {{heure}} 상담({{type_prospection}})에 감사드립니다.</p>
<p>{{note}}</p>
<p><strong>다음 단계:</strong> {{prochaine_action}}</p>
<p>{{bouton_site}}</p>
<p>궁금한 점은 언제든 연락 주세요: {{gestionnaire_telephone}} · {{gestionnaire_email}}</p>
<p>{{gestionnaire}}, {{site}} 드림</p>`,
    },
  },
};

/** Agences : voiture associée à une agence, gestionnaire rattaché à une agence ; email marketing des clients. */
type Key3 = "car_agency_assigned" | "manager_agency_joined" | "marketing_promotion";
const T3: Record<Lang, Record<Key3, Tpl>> = {
  fr: {
    car_agency_assigned: {
      subject: "{{agence}} : {{nombre_voitures}} voiture(s) associée(s) à votre agence",
      html: `<h2>Bonjour {{destinataire}},</h2>
<p>{{ajoute_par}} vient d'associer {{nombre_voitures}} voiture(s) à l'agence <strong>{{agence}}</strong> :</p>
<p>{{voitures}}</p>
<p>{{bouton_agence}}</p>
<p>L'équipe {{site}}</p>`,
    },
    manager_agency_joined: {
      subject: "{{prenom}} {{nom}} rejoint l'agence {{agence}}",
      html: `<h2>Bonjour {{destinataire}},</h2>
<p>{{ajoute_par}} vient de rattacher <strong>{{civilite}} {{prenom}} {{nom}}</strong> à l'agence <strong>{{agence}}</strong>.</p>
<p>Coordonnées : {{email}} · {{telephone}}</p>
<p>{{bouton_agence}}</p>
<p>L'équipe {{site}}</p>`,
    },
    marketing_promotion: {
      subject: "{{prenom}}, -{{remise}} sur votre prochaine location {{site}}",
      html: `<h2>Bonjour {{civilite}} {{prenom}} {{nom}},</h2>
<p>{{message}}</p>
<p>Nous vous offrons <strong>{{remise}} de réduction</strong> sur votre prochaine location (à partir de {{jours_min}} jour(s)), valable jusqu'au {{date_fin}}.</p>
<p>Cliquez sur le bouton : le code <strong>{{code_promo}}</strong> est ajouté à votre compte et appliqué à votre réservation.</p>
<p>{{bouton_promo}}</p>
<p>À très vite sur la route,<br>L'équipe {{site}}</p>`,
    },
  },
  en: {
    car_agency_assigned: {
      subject: "{{agence}}: {{nombre_voitures}} car(s) added to your branch",
      html: `<h2>Hello {{destinataire}},</h2>
<p>{{ajoute_par}} has just added {{nombre_voitures}} car(s) to the <strong>{{agence}}</strong> branch:</p>
<p>{{voitures}}</p>
<p>{{bouton_agence}}</p>
<p>The {{site}} team</p>`,
    },
    manager_agency_joined: {
      subject: "{{prenom}} {{nom}} joins the {{agence}} branch",
      html: `<h2>Hello {{destinataire}},</h2>
<p>{{ajoute_par}} has just assigned <strong>{{prenom}} {{nom}}</strong> to the <strong>{{agence}}</strong> branch.</p>
<p>Contact: {{email}} · {{telephone}}</p>
<p>{{bouton_agence}}</p>
<p>The {{site}} team</p>`,
    },
    marketing_promotion: {
      subject: "{{prenom}}, {{remise}} off your next {{site}} rental",
      html: `<h2>Hello {{prenom}} {{nom}},</h2>
<p>{{message}}</p>
<p>Enjoy <strong>{{remise}} off</strong> your next rental (from {{jours_min}} day(s)), valid until {{date_fin}}.</p>
<p>Click the button: the code <strong>{{code_promo}}</strong> is added to your account and applied to your booking.</p>
<p>{{bouton_promo}}</p>
<p>See you on the road,<br>The {{site}} team</p>`,
    },
  },
  es: {
    car_agency_assigned: {
      subject: "{{agence}}: {{nombre_voitures}} coche(s) asociado(s) a su agencia",
      html: `<h2>Hola {{destinataire}}:</h2>
<p>{{ajoute_par}} acaba de asociar {{nombre_voitures}} coche(s) a la agencia <strong>{{agence}}</strong>:</p>
<p>{{voitures}}</p>
<p>{{bouton_agence}}</p>
<p>El equipo de {{site}}</p>`,
    },
    manager_agency_joined: {
      subject: "{{prenom}} {{nom}} se une a la agencia {{agence}}",
      html: `<h2>Hola {{destinataire}}:</h2>
<p>{{ajoute_par}} acaba de asignar a <strong>{{prenom}} {{nom}}</strong> a la agencia <strong>{{agence}}</strong>.</p>
<p>Contacto: {{email}} · {{telephone}}</p>
<p>{{bouton_agence}}</p>
<p>El equipo de {{site}}</p>`,
    },
    marketing_promotion: {
      subject: "{{prenom}}, un {{remise}} de descuento en su próximo alquiler {{site}}",
      html: `<h2>Hola {{prenom}} {{nom}}:</h2>
<p>{{message}}</p>
<p>Le ofrecemos un <strong>{{remise}} de descuento</strong> en su próximo alquiler (a partir de {{jours_min}} día(s)), válido hasta el {{date_fin}}.</p>
<p>Pulse el botón: el código <strong>{{code_promo}}</strong> se añade a su cuenta y se aplica a su reserva.</p>
<p>{{bouton_promo}}</p>
<p>Hasta pronto en la carretera,<br>El equipo de {{site}}</p>`,
    },
  },
  de: {
    car_agency_assigned: {
      subject: "{{agence}}: {{nombre_voitures}} Fahrzeug(e) Ihrer Filiale zugeordnet",
      html: `<h2>Hallo {{destinataire}},</h2>
<p>{{ajoute_par}} hat soeben {{nombre_voitures}} Fahrzeug(e) der Filiale <strong>{{agence}}</strong> zugeordnet:</p>
<p>{{voitures}}</p>
<p>{{bouton_agence}}</p>
<p>Ihr {{site}}-Team</p>`,
    },
    manager_agency_joined: {
      subject: "{{prenom}} {{nom}} verstärkt die Filiale {{agence}}",
      html: `<h2>Hallo {{destinataire}},</h2>
<p>{{ajoute_par}} hat <strong>{{prenom}} {{nom}}</strong> soeben der Filiale <strong>{{agence}}</strong> zugeordnet.</p>
<p>Kontakt: {{email}} · {{telephone}}</p>
<p>{{bouton_agence}}</p>
<p>Ihr {{site}}-Team</p>`,
    },
    marketing_promotion: {
      subject: "{{prenom}}, {{remise}} Rabatt auf Ihre nächste Miete bei {{site}}",
      html: `<h2>Hallo {{prenom}} {{nom}},</h2>
<p>{{message}}</p>
<p>Wir schenken Ihnen <strong>{{remise}} Rabatt</strong> auf Ihre nächste Miete (ab {{jours_min}} Tag(en)), gültig bis {{date_fin}}.</p>
<p>Klicken Sie auf die Schaltfläche: Der Code <strong>{{code_promo}}</strong> wird Ihrem Konto hinzugefügt und bei Ihrer Buchung angewendet.</p>
<p>{{bouton_promo}}</p>
<p>Bis bald auf der Straße,<br>Ihr {{site}}-Team</p>`,
    },
  },
  ar: {
    car_agency_assigned: {
      subject: "{{agence}}: تم ربط {{nombre_voitures}} سيارة بوكالتك",
      html: rtl(`<h2>مرحبًا {{destinataire}}،</h2>
<p>قام {{ajoute_par}} بربط {{nombre_voitures}} سيارة بوكالة <strong>{{agence}}</strong>:</p>
<p>{{voitures}}</p>
<p>{{bouton_agence}}</p>
<p>فريق {{site}}</p>`),
    },
    manager_agency_joined: {
      subject: "{{prenom}} {{nom}} ينضم إلى وكالة {{agence}}",
      html: rtl(`<h2>مرحبًا {{destinataire}}،</h2>
<p>قام {{ajoute_par}} بإلحاق <strong>{{prenom}} {{nom}}</strong> بوكالة <strong>{{agence}}</strong>.</p>
<p>بيانات الاتصال: {{email}} · {{telephone}}</p>
<p>{{bouton_agence}}</p>
<p>فريق {{site}}</p>`),
    },
    marketing_promotion: {
      subject: "{{prenom}}، تخفيض {{remise}} على كرائك القادم مع {{site}}",
      html: rtl(`<h2>مرحبًا {{prenom}} {{nom}}،</h2>
<p>{{message}}</p>
<p>نقدّم لك <strong>تخفيضًا بنسبة {{remise}}</strong> على كرائك القادم (ابتداءً من {{jours_min}} يوم)، صالحًا حتى {{date_fin}}.</p>
<p>اضغط على الزر: يُضاف الرمز <strong>{{code_promo}}</strong> إلى حسابك ويُطبَّق على حجزك.</p>
<p>{{bouton_promo}}</p>
<p>إلى اللقاء على الطريق،<br>فريق {{site}}</p>`),
    },
  },
  ary: {
    car_agency_assigned: {
      subject: "{{agence}}: تزادو {{nombre_voitures}} طوموبيل للوكالة ديالك",
      html: rtl(`<h2>السلام {{destinataire}}،</h2>
<p>{{ajoute_par}} زاد {{nombre_voitures}} طوموبيل للوكالة ديال <strong>{{agence}}</strong>:</p>
<p>{{voitures}}</p>
<p>{{bouton_agence}}</p>
<p>الفريق ديال {{site}}</p>`),
    },
    manager_agency_joined: {
      subject: "{{prenom}} {{nom}} دخل للوكالة ديال {{agence}}",
      html: rtl(`<h2>السلام {{destinataire}}،</h2>
<p>{{ajoute_par}} زاد <strong>{{prenom}} {{nom}}</strong> للوكالة ديال <strong>{{agence}}</strong>.</p>
<p>باش تتواصل معاه: {{email}} · {{telephone}}</p>
<p>{{bouton_agence}}</p>
<p>الفريق ديال {{site}}</p>`),
    },
    marketing_promotion: {
      subject: "{{prenom}}، عندك {{remise}} ديال التخفيض فالكرا الجاي مع {{site}}",
      html: rtl(`<h2>السلام {{prenom}} {{nom}}،</h2>
<p>{{message}}</p>
<p>عطيناك <strong>{{remise}} ديال التخفيض</strong> فالكرا الجاي ديالك (من {{jours_min}} نهار ولفوق)، صالح حتى لـ {{date_fin}}.</p>
<p>كليكي على البوطونة: الكود <strong>{{code_promo}}</strong> كيتزاد للحساب ديالك وكيتطبق على الحجز.</p>
<p>{{bouton_promo}}</p>
<p>نتشوفو فالطريق،<br>الفريق ديال {{site}}</p>`),
    },
  },
  ja: {
    car_agency_assigned: {
      subject: "{{agence}}：{{nombre_voitures}}台の車両が店舗に追加されました",
      html: `<h2>{{destinataire}} 様</h2>
<p>{{ajoute_par}} が <strong>{{agence}}</strong> 店舗に {{nombre_voitures}} 台の車両を追加しました。</p>
<p>{{voitures}}</p>
<p>{{bouton_agence}}</p>
<p>{{site}} チーム</p>`,
    },
    manager_agency_joined: {
      subject: "{{nom}} {{prenom}} が {{agence}} 店舗に加わりました",
      html: `<h2>{{destinataire}} 様</h2>
<p>{{ajoute_par}} が <strong>{{nom}} {{prenom}}</strong> を <strong>{{agence}}</strong> 店舗に配属しました。</p>
<p>連絡先：{{email}} · {{telephone}}</p>
<p>{{bouton_agence}}</p>
<p>{{site}} チーム</p>`,
    },
    marketing_promotion: {
      subject: "{{prenom}} 様、次回の {{site}} レンタルが {{remise}} オフ",
      html: `<h2>{{nom}} {{prenom}} 様</h2>
<p>{{message}}</p>
<p>次回のレンタル（{{jours_min}} 日以上）が <strong>{{remise}} オフ</strong>になります。有効期限：{{date_fin}}。</p>
<p>ボタンをクリックすると、コード <strong>{{code_promo}}</strong> がアカウントに追加され、予約に適用されます。</p>
<p>{{bouton_promo}}</p>
<p>{{site}} チーム</p>`,
    },
  },
  zh: {
    car_agency_assigned: {
      subject: "{{agence}}：{{nombre_voitures}} 辆车已关联到您的门店",
      html: `<h2>{{destinataire}}，您好：</h2>
<p>{{ajoute_par}} 刚刚将 {{nombre_voitures}} 辆车关联到 <strong>{{agence}}</strong> 门店：</p>
<p>{{voitures}}</p>
<p>{{bouton_agence}}</p>
<p>{{site}} 团队</p>`,
    },
    manager_agency_joined: {
      subject: "{{nom}}{{prenom}} 加入 {{agence}} 门店",
      html: `<h2>{{destinataire}}，您好：</h2>
<p>{{ajoute_par}} 刚刚将 <strong>{{nom}}{{prenom}}</strong> 分配到 <strong>{{agence}}</strong> 门店。</p>
<p>联系方式：{{email}} · {{telephone}}</p>
<p>{{bouton_agence}}</p>
<p>{{site}} 团队</p>`,
    },
    marketing_promotion: {
      subject: "{{prenom}}，您下次在 {{site}} 租车可享 {{remise}} 优惠",
      html: `<h2>{{nom}}{{prenom}}，您好：</h2>
<p>{{message}}</p>
<p>您下次租车（{{jours_min}} 天起）可享 <strong>{{remise}} 优惠</strong>，有效期至 {{date_fin}}。</p>
<p>点击按钮：优惠码 <strong>{{code_promo}}</strong> 将添加到您的账户并应用于您的预订。</p>
<p>{{bouton_promo}}</p>
<p>{{site}} 团队</p>`,
    },
  },
  ko: {
    car_agency_assigned: {
      subject: "{{agence}}: 차량 {{nombre_voitures}}대가 지점에 배정되었습니다",
      html: `<h2>{{destinataire}}님, 안녕하세요.</h2>
<p>{{ajoute_par}}님이 <strong>{{agence}}</strong> 지점에 차량 {{nombre_voitures}}대를 배정했습니다.</p>
<p>{{voitures}}</p>
<p>{{bouton_agence}}</p>
<p>{{site}} 팀</p>`,
    },
    manager_agency_joined: {
      subject: "{{nom}}{{prenom}}님이 {{agence}} 지점에 합류합니다",
      html: `<h2>{{destinataire}}님, 안녕하세요.</h2>
<p>{{ajoute_par}}님이 <strong>{{nom}}{{prenom}}</strong>님을 <strong>{{agence}}</strong> 지점에 배정했습니다.</p>
<p>연락처: {{email}} · {{telephone}}</p>
<p>{{bouton_agence}}</p>
<p>{{site}} 팀</p>`,
    },
    marketing_promotion: {
      subject: "{{prenom}}님, 다음 {{site}} 렌트 {{remise}} 할인",
      html: `<h2>{{nom}}{{prenom}}님, 안녕하세요.</h2>
<p>{{message}}</p>
<p>다음 렌트({{jours_min}}일 이상)에 <strong>{{remise}} 할인</strong>을 드립니다. 유효기간: {{date_fin}}까지.</p>
<p>버튼을 누르면 코드 <strong>{{code_promo}}</strong>가 계정에 추가되어 예약에 적용됩니다.</p>
<p>{{bouton_promo}}</p>
<p>{{site}} 팀</p>`,
    },
  },
};

export function defaultTemplate(key: TemplateKey, locale: string): Tpl {
  const l: Lang = locale in T ? (locale as Lang) : "fr";
  if (key === "car_agency_assigned" || key === "manager_agency_joined" || key === "marketing_promotion") return T3[l][key];
  return key === "client_invite" || key === "prospect_followup" || key === "manager_password_set" ? T2[l][key] : T[l][key];
}
