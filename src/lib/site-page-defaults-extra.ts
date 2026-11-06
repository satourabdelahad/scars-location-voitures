/**
 * Textes par défaut des Services (page À propos) et de la phrase du bandeau, dans les 9 langues.
 * Services : chaque « ## Titre » suivi de son texte devient une carte.
 */
type Extra = { about_services: string; topbar_note: string };

export const EXTRA: Record<string, Extra> = {
  fr: {
    topbar_note: "Livraison gratuite à Témara, Rabat & à l'aéroport",
    about_services: `## Livraison à l'aéroport
Votre voiture vous attend à l'aéroport de Rabat-Salé, à l'heure de votre vol, de jour comme de nuit. Livraison et retour gratuits.

## Livraison à domicile, hôtel ou gare
Nous livrons et récupérons la voiture gratuitement à Témara et à Rabat : à votre adresse, à votre hôtel ou à la gare.

## Location longue durée
Pour une semaine, un mois ou plus : des tarifs dégressifs sur devis, avec entretien, assurance et assistance compris.

## Assurance et assistance 24h/24
Chaque location est assurée. En cas de panne ou d'accident, notre assistance répond jour et nuit et organise une solution de remplacement.

## Équipements à la demande
Siège bébé ou rehausseur, GPS, conducteur supplémentaire : précisez-le à la réservation, tout est prêt à la remise des clés.

## Réservation simple et rapide
Réservez en ligne en quelques minutes ou écrivez-nous sur WhatsApp. Vous recevez une confirmation rapide et le prix ne change pas.`,
  },
  en: {
    topbar_note: "Free delivery in Témara, Rabat & at the airport",
    about_services: `## Airport delivery
Your car waits for you at Rabat-Salé airport, on time for your flight, day or night. Free delivery and return.

## Home, hotel or station delivery
We deliver and collect the car for free in Témara and Rabat: at your address, your hotel or the train station.

## Long-term rental
For a week, a month or longer: decreasing rates on quote, with maintenance, insurance and assistance included.

## Insurance and 24/7 assistance
Every rental is insured. In case of breakdown or accident, our assistance answers day and night and arranges a replacement.

## Equipment on request
Baby seat or booster, GPS, additional driver: mention it when booking and everything is ready when you collect the keys.

## Simple, fast booking
Book online in a few minutes or write to us on WhatsApp. You get a quick confirmation and the price does not change.`,
  },
  es: {
    topbar_note: "Entrega gratuita en Témara, Rabat y en el aeropuerto",
    about_services: `## Entrega en el aeropuerto
Su coche le espera en el aeropuerto de Rabat-Salé, a la hora de su vuelo, de día o de noche. Entrega y devolución gratuitas.

## Entrega a domicilio, hotel o estación
Entregamos y recogemos el coche gratis en Témara y Rabat: en su dirección, su hotel o la estación de tren.

## Alquiler de larga duración
Para una semana, un mes o más: tarifas decrecientes bajo presupuesto, con mantenimiento, seguro y asistencia incluidos.

## Seguro y asistencia 24 h
Todos los alquileres están asegurados. En caso de avería o accidente, nuestra asistencia responde día y noche y organiza una solución de sustitución.

## Equipamiento a petición
Silla de bebé o elevador, GPS, conductor adicional: indíquelo al reservar y todo estará listo al entregar las llaves.

## Reserva sencilla y rápida
Reserve en línea en unos minutos o escríbanos por WhatsApp. Recibirá una confirmación rápida y el precio no cambia.`,
  },
  de: {
    topbar_note: "Kostenlose Lieferung in Témara, Rabat & zum Flughafen",
    about_services: `## Lieferung zum Flughafen
Ihr Auto wartet am Flughafen Rabat-Salé passend zu Ihrem Flug, Tag und Nacht. Lieferung und Rückgabe kostenlos.

## Lieferung nach Hause, ins Hotel oder zum Bahnhof
Wir liefern und holen das Auto in Témara und Rabat kostenlos ab: an Ihrer Adresse, Ihrem Hotel oder am Bahnhof.

## Langzeitmiete
Für eine Woche, einen Monat oder länger: günstigere Tarife auf Anfrage, mit Wartung, Versicherung und Pannenhilfe.

## Versicherung und Hilfe rund um die Uhr
Jede Miete ist versichert. Bei Panne oder Unfall ist unsere Hilfe Tag und Nacht erreichbar und organisiert einen Ersatz.

## Ausstattung auf Wunsch
Kindersitz oder Sitzerhöhung, Navi, Zusatzfahrer: Geben Sie es bei der Buchung an, alles ist bei der Schlüsselübergabe bereit.

## Einfach und schnell buchen
Buchen Sie online in wenigen Minuten oder schreiben Sie uns per WhatsApp. Sie erhalten schnell eine Bestätigung, der Preis bleibt gleich.`,
  },
  ar: {
    topbar_note: "توصيل مجاني في تمارة والرباط والمطار",
    about_services: `## التوصيل إلى المطار
سيارتك في انتظارك بمطار الرباط-سلا في موعد رحلتك، ليلًا ونهارًا. التوصيل والإرجاع مجانًا.

## التوصيل إلى المنزل أو الفندق أو المحطة
نوصل السيارة ونستلمها مجانًا في تمارة والرباط: إلى عنوانك أو فندقك أو محطة القطار.

## الكراء طويل الأمد
لأسبوع أو شهر أو أكثر: أسعار تنازلية حسب الطلب، تشمل الصيانة والتأمين والمساعدة.

## التأمين والمساعدة 24/24
كل كراء مؤمَّن. في حالة عطب أو حادث، تجيبك مساعدتنا ليلًا ونهارًا وتوفر حلًا بديلًا.

## تجهيزات حسب الطلب
مقعد للرضع أو مقعد رافع، جهاز GPS، سائق إضافي: اذكر ذلك عند الحجز ويكون كل شيء جاهزًا عند تسليم المفاتيح.

## حجز سهل وسريع
احجز عبر الإنترنت في دقائق أو راسلنا على واتساب. تتوصل بتأكيد سريع والسعر لا يتغير.`,
  },
  ary: {
    topbar_note: "التوصيل فابور فتمارة والرباط وفالمطار",
    about_services: `## التوصيل للمطار
الطوموبيل ديالك كتسناك فمطار الرباط-سلا فالوقت ديال الطيارة ديالك، بالليل ولا بالنهار. التوصيل والرجوع فابور.

## التوصيل للدار، للأوطيل ولا للگار
كنوصلو الطوموبيل وكنجمعوها فابور فتمارة والرباط: للعنوان ديالك، للأوطيل ولا للگار.

## الكرا لمدة طويلة
لسيمانة، شهر ولا كثر: أثمنة كتنقص على حساب الطلب، فيها الصيانة والتأمين والمساعدة.

## التأمين والمساعدة 24/24
كل كرا مأمن. إلا وقعات شي پان ولا شي حادثة، المساعدة ديالنا كتجاوب بالليل والنهار وكتلقى ليك حل.

## التجهيزات على حساب الطلب
كرسي ديال الدري ولا رفاع، GPS، شيفور زايد: قولها فالحجز وكلشي كيكون واجد ملي تاخد الساروت.

## حجز ساهل وزربان
حجز أونلاين فشي دقايق ولا كتب لينا فواتساب. كيوصلك التأكيد دغيا والثمن ما كيتبدلش.`,
  },
  ja: {
    topbar_note: "テマラ・ラバト・空港への無料配車",
    about_services: `## 空港への配車
ラバト・サレ空港で、フライトの時間に合わせて昼夜を問わずお車をご用意します。配車・返却は無料です。

## ご自宅・ホテル・駅への配車
テマラとラバトでは、ご住所、ホテル、駅まで無料でお届け・お引き取りします。

## 長期レンタル
1週間、1か月、それ以上：メンテナンス・保険・サポート込みの割安料金をお見積もりします。

## 保険と24時間サポート
すべてのレンタルは保険付きです。故障や事故の際は、24時間対応のサポートが代替手段を手配します。

## ご希望の装備
チャイルドシート、ジュニアシート、GPS、追加運転者：予約時にお知らせいただければ、鍵のお渡し時にご用意します。

## かんたん・スピーディーな予約
オンラインで数分で予約、またはWhatsAppでご連絡ください。すぐに確認のご連絡をし、料金は変わりません。`,
  },
  zh: {
    topbar_note: "特马拉、拉巴特及机场免费送车",
    about_services: `## 机场送车
您的车会按航班时间在拉巴特-萨累机场等候，日夜皆可。免费送车和还车。

## 送车到家、酒店或车站
在特马拉和拉巴特，我们免费送车上门并取车：您的住址、酒店或火车站均可。

## 长期租车
一周、一个月或更长时间：报价享递减价格，含保养、保险和协助。

## 保险与 24 小时协助
每笔租车均已投保。如遇故障或事故，我们的协助团队日夜响应并安排替代方案。

## 按需配备
儿童座椅或增高垫、GPS、额外驾驶人：预订时注明，交车时一切准备就绪。

## 简单快捷的预订
几分钟即可在线预订，或通过 WhatsApp 联系我们。快速确认，价格不变。`,
  },
  ko: {
    topbar_note: "테마라·라바트·공항 무료 배송",
    about_services: `## 공항 배송
라바트-살레 공항에서 항공편 시간에 맞춰 밤낮없이 차량이 기다립니다. 배송과 반납은 무료입니다.

## 자택·호텔·역 배송
테마라와 라바트에서는 주소지, 호텔, 기차역까지 무료로 배송하고 회수합니다.

## 장기 렌트
일주일, 한 달 또는 그 이상: 정비, 보험, 지원이 포함된 할인 요금을 견적으로 안내합니다.

## 보험 및 24시간 지원
모든 렌트는 보험에 가입되어 있습니다. 고장이나 사고 시 24시간 지원팀이 대체 방안을 마련합니다.

## 요청 시 장비 제공
유아용 시트나 부스터, GPS, 추가 운전자: 예약 시 알려 주시면 열쇠를 받을 때 모두 준비됩니다.

## 쉽고 빠른 예약
몇 분 만에 온라인으로 예약하거나 WhatsApp으로 메시지를 보내 주세요. 빠르게 확인해 드리며 가격은 바뀌지 않습니다.`,
  },
};
