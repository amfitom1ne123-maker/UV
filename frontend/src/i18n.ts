// src/i18n.ts

export type Lang = "en" | "ru" | "km" | "zh";
type Dict = Record<string, string>;

/** ---------------- UI словари ---------------- */
const ru: Dict = {
  // common
  hi: "Привет",
  menu: "Меню",
  news: "Новости",
  map: "Карта",
  profile: "Профиль",
  services: "Сервисы",
  payments: "Платежи",
  requests: "Заявки",
  myRequests: "Мои заявки",
  createRequest: "Создать заявку",
  loading: "Загрузка…",
  refresh: "Обновить",
  save: "Сохранить",
  send: "Отправить",
  error: "Ошибка",
  saved: "Сохранено",
  back: "Назад",
  cancel: "Отмена",
  status: "Статус",
  id: "ID",
  created_at: "Создано",

  // menu buttons
  menu_services: "Сервисы",
  menu_payments: "Платежи",

  // forms / placeholders
  ph_name: "Имя",
  ph_email: "E-mail",
  ph_phone: "Телефон",
  ph_unit: "Квартира/Блок (опционально)",
  ph_details: "Опишите проблему…",

  // history
  no_requests: "Пока нет заявок.",

  // statuses
  st_pending: "новая",
  st_confirmed: "подтверждена",
  st_done: "выполнено",
  st_cancelled: "отменено",
  st_cancelled_by_user: "отменено пользователем",

  // profile
  reg_title: "Регистрация",

  // map
  map_title: "Карта комплекса",
  map_placeholder: "Тут будет карта (embed/tiles).",
};

const en: Dict = {
  hi: "Hi",
  menu: "Menu",
  news: "News",
  map: "Map",
  profile: "Profile",
  services: "Services",
  payments: "Payments",
  requests: "Requests",
  myRequests: "My Requests",
  createRequest: "Create request",
  loading: "Loading…",
  refresh: "Refresh",
  save: "Save",
  send: "Send",
  error: "Error",
  saved: "Saved",
  back: "Back",
  cancel: "Cancel",
  status: "Status",
  id: "ID",
  created_at: "Created",

  menu_services: "Services",
  menu_payments: "Payments",

  ph_name: "Name",
  ph_email: "E-mail",
  ph_phone: "Phone",
  ph_unit: "Unit (optional)",
  ph_details: "Describe the issue…",

  no_requests: "No requests yet.",

  st_pending: "pending",
  st_confirmed: "confirmed",
  st_done: "done",
  st_cancelled: "cancelled",
  st_cancelled_by_user: "cancelled by user",

  reg_title: "Registration",

  map_title: "Complex map",
  map_placeholder: "Map placeholder (embed/tiles).",
};

const km: Dict = {
  hi: "សួស្តី",
  menu: "ម៉ឺនុយ",
  news: "ព័ត៌មាន",
  map: "ផែនទី",
  profile: "ប្រវត្តិរូប",
  services: "សេវាកម្ម",
  payments: "ការទូទាត់",
  requests: "សំណើ",
  myRequests: "សំណើរបស់ខ្ញុំ",
  createRequest: "បង្កើតសំណើ",
  loading: "កំពុងផ្ទុក…",
  refresh: "ធ្វើបច្ចុប្បន្នភាព",
  save: "រក្សាទុក",
  send: "ផ្ញើ",
  error: "កំហុស",
  saved: "បានរក្សាទុក",
  back: "ត្រឡប់ក្រោយ",
  cancel: "បោះបង់",
  status: "ស្ថានភាព",
  id: "ID",
  created_at: "បានបង្កើត",

  menu_services: "សេវាកម្ម",
  menu_payments: "ការទូទាត់",

  ph_name: "ឈ្មោះ",
  ph_email: "អ៊ីមែល",
  ph_phone: "ទូរស័ព្ទ",
  ph_unit: "បន្ទប់/អាគារ (ស្រេចចិត្ត)",
  ph_details: "ពិពណ៌នាបញ្ហា…",

  no_requests: "មិនទាន់មានសំណើទេ។",

  st_pending: "មិនទាន់ដំណើរការ",
  st_confirmed: "បញ្ជាក់រួច",
  st_done: "រួចរាល់",
  st_cancelled: "បានបោះបង់",
  st_cancelled_by_user: "បានបោះបង់ដោយអ្នកប្រើ",

  reg_title: "ចុះឈ្មោះ",

  map_title: "ផែនទីបុរី",
  map_placeholder: "ទីតាំងផែនទី (embed/tiles).",
};

const zh: Dict = {
  hi: "你好",
  menu: "菜单",
  news: "新闻",
  map: "地图",
  profile: "个人资料",
  services: "服务",
  payments: "支付",
  requests: "请求",
  myRequests: "我的请求",
  createRequest: "创建请求",
  loading: "加载中…",
  refresh: "刷新",
  save: "保存",
  send: "发送",
  error: "错误",
  saved: "已保存",
  back: "返回",
  cancel: "取消",
  status: "状态",
  id: "ID",
  created_at: "创建于",

  menu_services: "服务",
  menu_payments: "支付",

  ph_name: "姓名",
  ph_email: "邮箱",
  ph_phone: "电话",
  ph_unit: "房号/楼栋（可选）",
  ph_details: "描述问题…",

  no_requests: "暂无请求。",

  st_pending: "待处理",
  st_confirmed: "已确认",
  st_done: "已完成",
  st_cancelled: "已取消",
  st_cancelled_by_user: "用户取消",

  reg_title: "注册",

  map_title: "小区地图",
  map_placeholder: "地图占位（embed/tiles）。",
};

export const T: Record<Lang, Dict> = { ru, en, km, zh };

/** безопасный геттер */
export function t(lang: Lang, key: string): string {
  const d = T[lang] || T.en;
  return d[key] ?? T.en[key] ?? key;
}

/** ---------------- Названия сервисов (ровно по твоим ServiceCode) ---------------- */
type ServiceCode =
  | "clean"   // уборка
  | "ac"      // кондиционер
  | "plumb"   // сантехника
  | "elec"    // электрика
  | "repair"  // мелкий ремонт
  | "pest"    // дератизация
  | "net"     // интернет
  | "locks"   // замки/ключи
  | "delivery"; // доставка

const svcLabels: Record<ServiceCode, { en: string; ru: string; km: string; zh: string }> = {
  clean:   { en: "Cleaning",        ru: "Уборка",          km: "សម្អាត",           zh: "清洁" },
  ac:      { en: "Air conditioning", ru: "Кондиционер",    km: "ម៉ាស៊ីនត្រជាក់",   zh: "空调" },
  plumb:   { en: "Plumbing",         ru: "Сантехника",      km: "បំពង់ទឹក",        zh: "管道" },
  elec:    { en: "Electricity",      ru: "Электрика",       km: "អគ្គិសនី",        zh: "电力" },
  repair:  { en: "Repair",           ru: "Ремонт",          km: "ជួសជុល",          zh: "维修" },
  pest:    { en: "Pest control",     ru: "Дератизация",     km: "បង្ការ​សត្វល្អិត", zh: "害虫防治" },
  net:     { en: "Internet",         ru: "Интернет",        km: "អ៊ីនធឺណិត",      zh: "互联网" },
  locks:   { en: "Locks/Keys",       ru: "Замки/Ключи",     km: "សោ/គ្រាប់សោ",     zh: "锁/钥匙" },
  delivery:{ en: "Delivery",         ru: "Доставка",        km: "ដឹកជញ្ជូន",      zh: "配送" },
};

export function svcLabel(code: ServiceCode, lang: Lang): string {
  const l = (["en", "ru", "km", "zh"] as Lang[]).includes(lang) ? lang : "en";
  return (svcLabels as any)[code]?.[l] || String(code);
}

/** ---------------- Статусы заявок → локализованный лейбл ----------------
 * Поддерживаем алиасы: "new"→"pending", "in_progress"/"in progress"→"confirmed"
 */
export function statusLabel(lang: Lang, status: string): string {
  const s = (status || "").toLowerCase().replace(/\s+/g, "_");
  const canon =
    s === "new" ? "pending" :
    s === "in_progress" ? "confirmed" :
    s === "in" ? "confirmed" :
    s === "inprogress" ? "confirmed" :
    s === "in_progresss" ? "confirmed" :
    s === "in_progress_" ? "confirmed" :
    s === "in_progress__" ? "confirmed" :
    s === "in_progress___" ? "confirmed" :
    s === "in_progress " ? "confirmed" :
    s === "in_progress\t" ? "confirmed" :
    s === "in_progress\r" ? "confirmed" :
    s === "in_progress\n" ? "confirmed" :
    s === "in_progress" || s === "in_progress_confirmed" ? "confirmed" :
    s === "in_progress__confirmed" ? "confirmed" :
    s === "in_progress___confirmed" ? "confirmed" :
    s === "in_progress__done" ? "confirmed" :
    s === "in" || s === "in progress" ? "confirmed" :
    s;

  const key =
    canon === "pending"            ? "st_pending" :
    canon === "confirmed"          ? "st_confirmed" :
    canon === "done"               ? "st_done" :
    canon === "cancelled_by_user"  ? "st_cancelled_by_user" :
                                     "st_cancelled";
  return t(lang, key);
}
