import { format } from 'date-fns';
import { formatEthiopianDeadline } from './ethiopian-calendar';

export interface PlateData {
  category?: string;
  system?: string;
  amharic?: string;
  english?: string;
  serial?: string;
  isEV?: boolean;
  isPD?: boolean;
}

/**
 * Escapes characters that could break Telegram HTML parse mode.
 */
export function escapeHtml(str: string = ''): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Parses a raw plate string (e.g. JSON string or formatted string) into structured components.
 */
export function parsePlateNumber(plateStr?: string): PlateData | null {
  if (!plateStr || typeof plateStr !== 'string') return null;
  const trimmed = plateStr.trim();
  if (!trimmed) return null;

  // 1. Try parsing JSON format
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const data = JSON.parse(trimmed);
      if (data && typeof data === 'object') {
        return {
          category: String(data.category || '2').toLowerCase(),
          system: data.system || 'old',
          amharic: data.amharic || 'ኢትዮጵያ',
          english: data.english || 'ET',
          serial: String(data.serial || '').trim(),
          isEV: Boolean(data.isEV),
          isPD: Boolean(data.isPD),
        };
      }
    } catch {
      // Continue to regex patterns
    }
  }

  // 2. Pattern: "Code 2 - AA B12345" or "Code 2 - 12345"
  const codePrefixMatch = trimmed.match(/^Code\s*(\d+|UN|AU|POLICE|TEMP)\s*[-:•]?\s*([A-Za-z]{2,4})?\s*(.+)$/i);
  if (codePrefixMatch) {
    return {
      category: codePrefixMatch[1].toLowerCase(),
      system: 'new',
      amharic: 'ኢትዮጵያ',
      english: codePrefixMatch[2]?.toUpperCase() || 'ET',
      serial: codePrefixMatch[3].trim(),
    };
  }

  // 3. Pattern: "AA 2-12345" or "AA-2-12345" or "ET 2 12345"
  const regMatch = trimmed.match(/^([A-Za-z]{2,4})\s*[-:•]?\s*([1-5]|UN|AU|POLICE|TEMP)\s*[-:•\s]\s*(.+)$/i);
  if (regMatch) {
    return {
      category: regMatch[2].toLowerCase(),
      system: 'new',
      amharic: 'ኢትዮጵያ',
      english: regMatch[1].toUpperCase(),
      serial: regMatch[3].trim(),
    };
  }

  // 4. Pattern: "2-E89012" or "3-F90123" or "2 - 12345"
  const simpleMatch = trimmed.match(/^([1-5]|UN|AU|POLICE|TEMP)\s*[-:•]\s*(.+)$/i);
  if (simpleMatch) {
    return {
      category: simpleMatch[1].toLowerCase(),
      system: 'old',
      amharic: 'ኢትዮጵያ',
      english: 'ET',
      serial: simpleMatch[2].trim(),
    };
  }

  return null;
}

/**
 * Formats a raw or JSON plate number into an attractive, human-readable string.
 */
export function formatPlateNumber(plateStr?: string): string {
  if (!plateStr) return 'N/A';
  const data = parsePlateNumber(plateStr);
  if (data) {
    let catText = `Code ${data.category}`;
    if (['un', 'au', 'temp', 'police'].includes(data.category?.toLowerCase() || '')) {
      catText = (data.category || '').toUpperCase();
    }
    const region = data.english || data.amharic || 'ET';
    const evTag = data.isEV ? ' ⚡[EV]' : '';
    const pdTag = data.isPD ? ' 🛡️[PD]' : '';
    const serial = data.serial ? ` ${data.serial}` : '';
    return `${catText} • ${region}${serial}${evTag}${pdTag}`;
  }
  return escapeHtml(plateStr);
}

/**
 * Formats brand and model into a human-readable vehicle title without repeating brand names.
 */
export function formatVehicleTitle(vehicle: any): string {
  if (!vehicle) return 'Vehicle (Not Specified)';
  const brandName = vehicle.carModel?.brand?.name?.trim() || '';
  const modelName = vehicle.carModel?.name?.trim() || vehicle.model?.name?.trim() || '';

  if (brandName && modelName) {
    if (modelName.toLowerCase().startsWith(brandName.toLowerCase())) {
      return escapeHtml(modelName);
    }
    return escapeHtml(`${brandName} ${modelName}`);
  }
  if (modelName) return escapeHtml(modelName);
  if (brandName) return escapeHtml(brandName);
  return 'Vehicle (Not Specified)';
}

/**
 * Formats numbers into a clean currency format (e.g. 12,500.00 ETB).
 */
export function formatETB(amount: number | string): string {
  const num = Number(amount || 0);
  return `${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
}

/**
 * Telegram Premium Custom Emojis with verified fallback emojis.
 */
export const TG_ICONS = {
  car: '<tg-emoji emoji-id="5307565089400839127">🚗</tg-emoji>',
  sportsCar: '<tg-emoji emoji-id="5219767097353066253">🚘</tg-emoji>',
  clipboard: '<tg-emoji emoji-id="5197269100878907942">✍️</tg-emoji>',
  user: '<tg-emoji emoji-id="5260399854500191689">👤</tg-emoji>',
  phone: '<tg-emoji emoji-id="6039605143601680423">📞</tg-emoji>',
  plate: '<tg-emoji emoji-id="5886285355279193209">🏷</tg-emoji>',
  fsr: '<tg-emoji emoji-id="5257965810634202885">📁</tg-emoji>',
  clock: '<tg-emoji emoji-id="5445350406215465190">⏰</tg-emoji>',
  hourglass: '<tg-emoji emoji-id="5258258882022612173">⏲</tg-emoji>',
  wrench: '<tg-emoji emoji-id="5462921117423384478">🛠</tg-emoji>',
  tools: '<tg-emoji emoji-id="5462921117423384478">🛠</tg-emoji>',
  package: '<tg-emoji emoji-id="5884479287171485878">📦</tg-emoji>',
  crew: '<tg-emoji emoji-id="5197371802136892976">⛏</tg-emoji>',
  inspect: '<tg-emoji emoji-id="5445255929819854310">🔎</tg-emoji>',
  notes: '<tg-emoji emoji-id="5258331647358540449">✍️</tg-emoji>',
  money: '<tg-emoji emoji-id="5224257782013769471">💰</tg-emoji>',
  cash: '<tg-emoji emoji-id="5224257782013769471">💰</tg-emoji>',
  card: '<tg-emoji emoji-id="5472250091332993630">💳</tg-emoji>',
  paid: '<tg-emoji emoji-id="5980930633298350051">✅</tg-emoji>',
  warning: '<tg-emoji emoji-id="6269176896534091959">⚠️</tg-emoji>',
  sparkles: '<tg-emoji emoji-id="5463297803235113601">✨</tg-emoji>',
  bullet: '<tg-emoji emoji-id="5463297803235113601">✨</tg-emoji>',
  fire: '<tg-emoji emoji-id="5395695537687123235">🚨</tg-emoji>',
  deposit: '<tg-emoji emoji-id="5443127283898405358">📥</tg-emoji>',
  pin: '<tg-emoji emoji-id="6269321542442685793">📌</tg-emoji>',
  chart: '<tg-emoji emoji-id="6269397073737553354">📊</tg-emoji>',
  ethiopian: '<tg-emoji emoji-id="5269679685393989166">🇪🇹</tg-emoji>',
  global: '<tg-emoji emoji-id="5465166522030764559">🐈‍⬛</tg-emoji>',
  tire: '<tg-emoji emoji-id="5377521684221815300">🛞</tg-emoji>'
};

export class TelegramService {
  private static getBotToken(): string {
    return process.env.TELEGRAM_BOT_TOKEN || '[TOKEN]';
  }

  private static getChatId(): string {
    return process.env.TELEGRAM_CHAT_ID || '';
  }

  static isConfigured(): boolean {
    const token = this.getBotToken();
    const chatId = this.getChatId();
    return Boolean(token && token !== '[TOKEN]' && chatId);
  }

  static async sendMessage(text: string): Promise<boolean> {
    const token = this.getBotToken();
    const chatId = this.getChatId();

    if (!token || token === '[TOKEN]' || !chatId) {
      console.log('====================================================');
      console.log('[Telegram Notification (Simulated - Token is [TOKEN] or Chat ID not configured)]');
      console.log(text.replace(/<[^>]*>/g, ''));
      console.log('====================================================');
      return true;
    }

    const sendPayload = async (msgText: string) => {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: msgText,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });
      return (await response.json()) as any;
    };

    try {
      let result = await sendPayload(text);

      // Graceful fallback 1: If Telegram rejects custom emoji tags, strip tags and keep fallback emoji
      if (!result.ok && text.includes('<tg-emoji')) {
        console.warn('[TelegramService] Retrying without custom emoji tags:', result.description);
        const strippedEmojiText = text.replace(/<tg-emoji[^>]*>(.*?)<\/tg-emoji>/gi, '$1');
        result = await sendPayload(strippedEmojiText);
      }

      // Graceful fallback 2: If expandable blockquotes are rejected by older Telegram API, fallback to standard quote
      if (!result.ok && text.includes('<blockquote expandable>')) {
        console.warn('[TelegramService] Retrying with standard blockquote:', result.description);
        const strippedBlockquoteText = text
          .replace(/<tg-emoji[^>]*>(.*?)<\/tg-emoji>/gi, '$1')
          .replace(/<blockquote expandable>/gi, '<blockquote>');
        result = await sendPayload(strippedBlockquoteText);
      }

      if (!result.ok) {
        console.error('[TelegramService] Telegram API Error:', result.description);
        return false;
      }
      return true;
    } catch (err: any) {
      console.error('[TelegramService] Failed to send Telegram notification:', err.message);
      return false;
    }
  }

  static formatDuration(ms: number): string {
    if (ms <= 0) return '0 minutes';
    const totalMinutes = Math.floor(ms / (1000 * 60));
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);
    const months = Math.floor(days / 30);

    if (months > 0) {
      const remainingDays = days % 30;
      return remainingDays > 0
        ? `${months} month${months > 1 ? 's' : ''} ${remainingDays} day${remainingDays > 1 ? 's' : ''}`
        : `${months} month${months > 1 ? 's' : ''}`;
    }
    if (days > 0) {
      const remainingHours = totalHours % 24;
      return remainingHours > 0
        ? `${days} day${days > 1 ? 's' : ''} ${remainingHours} hr${remainingHours > 1 ? 's' : ''}`
        : `${days} day${days > 1 ? 's' : ''}`;
    }
    if (totalHours > 0) {
      const remainingMinutes = totalMinutes % 60;
      return remainingMinutes > 0
        ? `${totalHours} hr${totalHours > 1 ? 's' : ''} ${remainingMinutes} min`
        : `${totalHours} hr${totalHours > 1 ? 's' : ''}`;
    }
    return `${totalMinutes} minute${totalMinutes > 1 ? 's' : ''}`;
  }

  static async sendOrderCreatedNotification(order: any): Promise<boolean> {
    const services = order.serviceLines || [];
    const materials = order.standaloneLines || [];
    const assignments = order.assignments || [];
    const carStatuses = order.carStatuses || [];
    const additionalCharges = order.additionalCharges || [];

    // Financial calculations
    let servicesSubtotal = 0;
    for (const sl of services) {
      servicesSubtotal += Number(sl.priceAtOrderTime || sl.priceAtTime || 0);
    }

    let materialsSubtotal = 0;
    for (const ml of materials) {
      materialsSubtotal += Number(ml.priceAtOrderTime || 0) * Number(ml.quantity || 1);
    }

    let additionalChargesTotal = 0;
    for (const ac of additionalCharges) {
      additionalChargesTotal += Number(ac.price || 0);
    }

    const serviceFee = Number(order.serviceFee || 0);
    const discount = Number(order.discountAmount || 0);
    const tax = Number(order.taxAmount || 0);

    const grossTotal = servicesSubtotal + materialsSubtotal + additionalChargesTotal + serviceFee;
    const total = Math.max(0, grossTotal - discount + tax);

    const downPayment = Number(order.downPayment || 0);
    const totalPaid = (order.payments || []).reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    const effectivePaid = Math.max(downPayment, totalPaid);
    const balanceDue = Math.max(0, total - effectivePaid);

    // Formatted vehicle and plate info
    const vehicleTitle = formatVehicleTitle(order.vehicle);
    const rawPlate = order.vehicle?.plateNumber || '';
    const formattedPlate = formatPlateNumber(rawPlate);

    // Customer info
    const customerName = escapeHtml(order.customer?.name || 'Walk-in Customer');
    const customerPhone = escapeHtml(order.customer?.phone || 'N/A');

    // Build services list text with generous spacing
    let servicesText = '<i>No specific services listed</i>';
    if (services.length > 0) {
      servicesText = services
        .map((s: any, idx: number) => {
          const cat = s.serviceCategory;
          const serviceName = escapeHtml(cat?.service?.nameEn || cat?.nameEn || s.name || `Service #${idx + 1}`);
          const catName = cat?.nameEn ? escapeHtml(cat.nameEn) : '';
          const price = Number(s.priceAtOrderTime || s.priceAtTime || 0);
          return [
            `${TG_ICONS.bullet} <b>${idx + 1}. ${serviceName}</b>`,
            catName ? `   ↳ Option: <i>${catName}</i>` : '',
            `   ↳ Price: <code>${formatETB(price)}</code>`,
          ]
            .filter(Boolean)
            .join('\n');
        })
        .join('\n\n');
    }

    // Build materials list text with full specs and generous spacing
    let materialsText = '';
    if (materials.length > 0) {
      materialsText = materials
        .map((m: any, idx: number) => {
          const matName = escapeHtml(m.material?.nameEn || m.material?.nameAm || m.name || `Part #${idx + 1}`);
          const brand = m.brandName || m.materialBrand?.name || '';
          const size = m.sizeName || '';
          const color = m.colorName || '';
          const type = m.typeName || '';
          const specsList = [brand, size, color, type].filter(Boolean);
          const specs = specsList.length > 0 ? escapeHtml(specsList.join(' • ')) : '';

          const qty = Number(m.quantity || 1);
          const unit = m.material?.unit ? escapeHtml(String(m.material.unit).toLowerCase()) : 'unit(s)';
          const price = Number(m.priceAtOrderTime || 0);
          const lineTotal = price * qty;

          return [
            `${TG_ICONS.bullet} <b>${idx + 1}. ${matName}</b>`,
            specs ? `   ↳ Spec: <i>${specs}</i>` : '',
            `   ↳ Qty: <b>${qty} ${unit}</b> &times; <code>${formatETB(price)}</code>`,
            `   ↳ Subtotal: <b><code>${formatETB(lineTotal)}</code></b>`,
          ]
            .filter(Boolean)
            .join('\n');
        })
        .join('\n\n');
    }

    // Build assignments text
    let assignmentsText = '<i>Unassigned</i>';
    if (assignments.length > 0) {
      assignmentsText = assignments
        .map((a: any) => {
          const empName = escapeHtml(a.employee?.name || a.name || 'Technician');
          const role = escapeHtml(a.roleLabel || a.role || 'Staff');
          return `• <b>${empName}</b> <i>(${role})</i>`;
        })
        .join('\n');
    }

    // Build condition notes
    let conditionText = '';
    if (carStatuses.length > 0) {
      const condList = carStatuses
        .map((cs: any) => escapeHtml(cs.customName || cs.carStatus?.name || 'Inspection note'))
        .join(', ');
      conditionText = condList;
    }

    // Build additional charges summary line
    let addChargesSummary = '';
    if (additionalCharges.length > 0) {
      const addLines = additionalCharges
        .map((ac: any) => `  ↳ ${escapeHtml(ac.name)}: <code>${formatETB(ac.price)}</code>`)
        .join('\n');
      addChargesSummary = `\n${addLines}`;
    }

    // Deadline Section (Prominently placed at the bottom of the work order)
    let deadlineSection = '';
    if (order.deadline) {
      const deadlineDate = new Date(order.deadline);
      const createdDate = new Date(order.createdAt || order.orderDateTime || Date.now());
      const durationMs = deadlineDate.getTime() - createdDate.getTime();
      const durationStr = this.formatDuration(durationMs);
      const formattedGregorian = format(deadlineDate, 'EEEE, MMM d, yyyy • h:mm a');
      const formattedEthiopian = formatEthiopianDeadline(deadlineDate);

      deadlineSection = [
        `${TG_ICONS.clock} <b>TARGET DELIVERY DEADLINE:</b>`,
        `<blockquote>`,
        `${TG_ICONS.ethiopian} <b>የኢትዮጵያ ቀን:</b> <b>${formattedEthiopian}</b>`,
        `${TG_ICONS.global} <b>Gregorian:</b> <b>${formattedGregorian}</b>`,
        ``,
        `${TG_ICONS.hourglass} <b>Allotted Duration:</b> <code>${durationStr}</code>`,
        `</blockquote>`,
      ].join('\n');
    } else {
      deadlineSection = [
        `${TG_ICONS.clock} <b>TARGET DELIVERY DEADLINE:</b>`,
        `<blockquote>`,
        `<i>⚠️ No delivery deadline specified for this order</i>`,
        `</blockquote>`,
      ].join('\n');
    }

    // Status badge
    let statusBadge = `${TG_ICONS.warning} <b>UNPAID</b>`;
    if (balanceDue === 0) {
      statusBadge = `${TG_ICONS.paid} <b>PAID IN FULL</b>`;
    } else if (effectivePaid > 0) {
      statusBadge = `${TG_ICONS.hourglass} <b>PARTIALLY PAID</b>`;
    }

    // Assemble payment & totals section with generous spacing
    const paymentLines: string[] = [
      `${TG_ICONS.money} <b>FINANCIAL &amp; PAYMENT BREAKDOWN:</b>`,
      `<blockquote>`,
      `${TG_ICONS.cash} <b>Services Subtotal:</b> <code>${formatETB(servicesSubtotal)}</code>`,
    ];

    if (materialsSubtotal > 0) {
      paymentLines.push(`${TG_ICONS.package} <b>Materials Subtotal:</b> <code>${formatETB(materialsSubtotal)}</code>`);
    }

    if (serviceFee > 0) {
      paymentLines.push(`${TG_ICONS.tools} <b>Service Fee:</b> <code>${formatETB(serviceFee)}</code>`);
    }

    if (additionalChargesTotal > 0) {
      paymentLines.push(
        `${TG_ICONS.notes} <b>Additional Charges:</b> <code>${formatETB(additionalChargesTotal)}</code>${addChargesSummary}`
      );
    }

    if (discount > 0) {
      paymentLines.push(`${TG_ICONS.plate} <b>Discount:</b> <code>-${formatETB(discount)}</code>`);
    }

    if (tax > 0) {
      paymentLines.push(`🏛️ <b>Tax / VAT:</b> <code>+${formatETB(tax)}</code>`);
    }

    paymentLines.push(`━━━━━━━━━━━━━━━━━`);
    paymentLines.push(`${TG_ICONS.card} <b>GRAND TOTAL:</b> <b><code>${formatETB(total)}</code></b>`);
    paymentLines.push(``); // Spacing before deposit
    paymentLines.push(`${TG_ICONS.deposit} <b>Down Payment:</b> <code>${formatETB(downPayment)}</code> <i>(Deducted)</i>`);

    if (totalPaid > downPayment) {
      paymentLines.push(`${TG_ICONS.cash} <b>Total Paid:</b> <code>${formatETB(totalPaid)}</code>`);
    }

    paymentLines.push(`${TG_ICONS.pin} <b>Balance Remaining:</b> <b><code>${formatETB(balanceDue)}</code></b>`);
    paymentLines.push(``); // Spacing before status
    paymentLines.push(`${TG_ICONS.chart} <b>Payment Status:</b> ${statusBadge}`);
    paymentLines.push(`</blockquote>`);

    const message = [
      `${TG_ICONS.tire} <b>NEW WORK ORDER CREATED</b>`,
      `━━━━━━━━━━━━━━━━━`,
      `<blockquote>`,
      `${TG_ICONS.clipboard} <b>Order Number:</b> <code>#${escapeHtml(order.orderNumber)}</code>`,
      order.fsrNumber ? `${TG_ICONS.fsr} <b>FSR Number:</b> <code>${escapeHtml(order.fsrNumber)}</code>` : '',
      ``,
      `${TG_ICONS.sportsCar} <b>Vehicle:</b> <b>${vehicleTitle}</b>`,
      `   ↳ ${TG_ICONS.plate} <b>Plate:</b> <code>${formattedPlate}</code>`,
      ``,
      `${TG_ICONS.user} <b>Customer:</b> <b>${customerName}</b>`,
      `   ↳ ${TG_ICONS.phone} <code>${customerPhone}</code>`,
      `</blockquote>`,
      ``,
      `${TG_ICONS.wrench} <b>WORK &amp; SERVICES (${services.length}):</b>`,
      `<blockquote expandable>`,
      servicesText,
      `</blockquote>`,
      ``,
      materials.length > 0
        ? [
            `${TG_ICONS.package} <b>PARTS &amp; MATERIALS (${materials.length}):</b>`,
            `<blockquote expandable>`,
            materialsText,
            `</blockquote>`,
            ``,
          ].join('\n')
        : '',
      `${TG_ICONS.crew} <b>ASSIGNED CREW (${assignments.length}):</b>`,
      `<blockquote>`,
      assignmentsText,
      `</blockquote>`,
      ``,
      conditionText
        ? [
            `${TG_ICONS.inspect} <b>Intake Inspection Notes:</b>`,
            `<blockquote>`,
            `<i>${conditionText}</i>`,
            `</blockquote>`,
            ``,
          ].join('\n')
        : '',
      order.notes
        ? [
            `${TG_ICONS.notes} <b>Order Notes:</b>`,
            `<blockquote>`,
            `<i>${escapeHtml(order.notes)}</i>`,
            `</blockquote>`,
            ``,
          ].join('\n')
        : '',
      paymentLines.join('\n'),
      ``,
      deadlineSection,
      ``,
      `━━━━━━━━━━━━━━━━━`,
      `🕒 <i>Created: ${format(new Date(order.createdAt || Date.now()), 'MMM d, yyyy • h:mm a')}</i>`,
    ]
      .filter((line) => line !== null && line !== undefined)
      .join('\n');

    return this.sendMessage(message);
  }

  static async sendDeadlineWarningNotification(order: any, ratio: number): Promise<boolean> {
    const deadlineDate = new Date(order.deadline);
    const createdDate = new Date(order.createdAt || order.orderDateTime || Date.now());
    const now = new Date();

    const totalMs = deadlineDate.getTime() - createdDate.getTime();
    const elapsedMs = now.getTime() - createdDate.getTime();
    const remainingMs = Math.max(0, deadlineDate.getTime() - now.getTime());

    const totalStr = this.formatDuration(totalMs);
    const elapsedStr = this.formatDuration(elapsedMs);
    const remainingStr = this.formatDuration(remainingMs);
    const percentStr = Math.round(ratio * 100);

    const vehicleTitle = formatVehicleTitle(order.vehicle);
    const rawPlate = order.vehicle?.plateNumber || '';
    const formattedPlate = formatPlateNumber(rawPlate);

    const customerName = escapeHtml(order.customer?.name || 'Walk-in Customer');
    const customerPhone = escapeHtml(order.customer?.phone || 'N/A');

    const services = (order.serviceLines || [])
      .map((s: any, idx: number) => {
        const cat = s.serviceCategory;
        const name = escapeHtml(cat?.service?.nameEn || cat?.nameEn || s.name || `Service #${idx + 1}`);
        return `  ${idx + 1}. <b>${name}</b>`;
      })
      .join('\n');

    const assignments = (order.assignments || [])
      .map((a: any) => {
        const empName = escapeHtml(a.employee?.name || a.name || 'Technician');
        const role = escapeHtml(a.roleLabel || a.role || 'Staff');
        return `• <b>${empName}</b> <i>(${role})</i>`;
      })
      .join('\n');

    const formattedGregorian = format(deadlineDate, 'EEEE, MMM d, yyyy • h:mm a');
    const formattedEthiopian = formatEthiopianDeadline(deadlineDate);

    const message = [
      `${TG_ICONS.warning} <b>DEADLINE WARNING: ${percentStr}% TIME ELAPSED</b> ${TG_ICONS.fire}`,
      `━━━━━━━━━━━━━━━━━`,
      `<blockquote>`,
      `🚨 <b>Urgent Attention Required!</b>`,
      `${TG_ICONS.clipboard} <b>Order Number:</b> <code>#${escapeHtml(order.orderNumber)}</code>`,
      order.fsrNumber ? `${TG_ICONS.fsr} <b>FSR Number:</b> <code>${escapeHtml(order.fsrNumber)}</code>` : '',
      ``,
      `${TG_ICONS.sportsCar} <b>Vehicle:</b> <b>${vehicleTitle}</b>`,
      `   ↳ ${TG_ICONS.plate} <b>Plate:</b> <code>${formattedPlate}</code>`,
      ``,
      `${TG_ICONS.user} <b>Customer:</b> <b>${customerName}</b>`,
      `   ↳ ${TG_ICONS.phone} <code>${customerPhone}</code>`,
      `</blockquote>`,
      ``,
      `${TG_ICONS.hourglass} <b>TIME PROGRESSION:</b>`,
      `<blockquote>`,
      `⏱️ <b>Total Allotted:</b> <code>${totalStr}</code>`,
      `⌛ <b>Time Elapsed:</b> <code>${elapsedStr}</code> (<b>${percentStr}%</b>)`,
      `🔴 <b>Time Remaining:</b> <b><code>${remainingStr}</code></b>`,
      ``,
      `${TG_ICONS.ethiopian} <b>የኢትዮጵያ ቀን:</b> <b>${formattedEthiopian}</b>`,
      `${TG_ICONS.global} <b>Target Deadline:</b> <b>${formattedGregorian}</b>`,
      `</blockquote>`,
      ``,
      services
        ? [
            `${TG_ICONS.wrench} <b>Services In Progress:</b>`,
            `<blockquote expandable>`,
            services,
            `</blockquote>`,
            ``,
          ].join('\n')
        : '',
      assignments
        ? [
            `${TG_ICONS.crew} <b>Assigned Technicians:</b>`,
            `<blockquote>`,
            assignments,
            `</blockquote>`,
            ``,
          ].join('\n')
        : '',
      `━━━━━━━━━━━━━━━━━`,
      `⚡ <i>Please prioritize completion of this order to avoid delivery delay!</i>`,
    ]
      .filter((line) => line !== null && line !== undefined)
      .join('\n');

    return this.sendMessage(message);
  }
}
