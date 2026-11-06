import { format } from 'date-fns';

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

    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });

      const result = (await response.json()) as any;
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
      return remainingDays > 0 ? `${months} month${months > 1 ? 's' : ''} ${remainingDays} day${remainingDays > 1 ? 's' : ''}` : `${months} month${months > 1 ? 's' : ''}`;
    }
    if (days > 0) {
      const remainingHours = totalHours % 24;
      return remainingHours > 0 ? `${days} day${days > 1 ? 's' : ''} ${remainingHours} hr${remainingHours > 1 ? 's' : ''}` : `${days} day${days > 1 ? 's' : ''}`;
    }
    if (totalHours > 0) {
      const remainingMinutes = totalMinutes % 60;
      return remainingMinutes > 0 ? `${totalHours} hr${totalHours > 1 ? 's' : ''} ${remainingMinutes} min` : `${totalHours} hr${totalHours > 1 ? 's' : ''}`;
    }
    return `${totalMinutes} minute${totalMinutes > 1 ? 's' : ''}`;
  }

  static async sendOrderCreatedNotification(order: any): Promise<boolean> {
    const services = order.serviceLines || [];
    const materials = order.standaloneLines || [];
    const assignments = order.assignments || [];
    const carStatuses = order.carStatuses || [];

    // Calculate financials
    let subtotal = 0;
    for (const sl of services) {
      subtotal += Number(sl.priceAtOrderTime || sl.priceAtTime || 0);
    }
    for (const ml of materials) {
      subtotal += Number(ml.priceAtOrderTime || 0) * Number(ml.quantity || 1);
    }
    if (order.additionalCharges) {
      for (const ac of order.additionalCharges) {
        subtotal += Number(ac.price || 0);
      }
    }
    if (order.serviceFee) {
      subtotal += Number(order.serviceFee || 0);
    }

    const discount = Number(order.discountAmount || 0);
    const tax = Number(order.taxAmount || 0);
    const total = subtotal - discount + tax;

    const downPayment = Number(order.downPayment || 0);
    const totalPaid = (order.payments || []).reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    const effectivePaid = Math.max(downPayment, totalPaid);
    const balanceDue = Math.max(0, total - effectivePaid);

    // Build services list text
    let servicesText = '<i>None specified</i>';
    if (services.length > 0) {
      servicesText = services
        .map((s: any, idx: number) => {
          const cat = s.serviceCategory;
          const serviceName = cat?.service?.nameEn || cat?.nameEn || s.name || `Service #${idx + 1}`;
          const catName = cat?.nameEn ? ` - ${cat.nameEn}` : '';
          const price = Number(s.priceAtOrderTime || s.priceAtTime || 0);
          return `  ${idx + 1}. <b>${serviceName}${catName}</b> (${price.toLocaleString()} ETB)`;
        })
        .join('\n');
    }

    // Build materials list text
    let materialsText = '';
    if (materials.length > 0) {
      materialsText = materials
        .map((m: any, idx: number) => {
          const matName = m.material?.nameEn || m.name || `Part #${idx + 1}`;
          const brand = m.brandName ? ` [${m.brandName}]` : '';
          const qty = Number(m.quantity || 1);
          const price = Number(m.priceAtOrderTime || 0);
          return `  ${idx + 1}. <b>${matName}${brand}</b> &times; ${qty} (${(price * qty).toLocaleString()} ETB)`;
        })
        .join('\n');
    }

    // Build assignments text
    let assignmentsText = '<i>Unassigned</i>';
    if (assignments.length > 0) {
      assignmentsText = assignments
        .map((a: any) => `  • <b>${a.employee?.name || a.name || 'Technician'}</b> (${a.roleLabel || a.role || 'Staff'})`)
        .join('\n');
    }

    // Build condition notes
    let conditionText = '';
    if (carStatuses.length > 0) {
      const condList = carStatuses
        .map((cs: any) => cs.customName || cs.carStatus?.name || 'Inspection note')
        .join(', ');
      conditionText = `🔍 <b>Intake Conditions:</b> ${condList}\n`;
    }

    // Deadline info
    let deadlineSection = '';
    if (order.deadline) {
      const deadlineDate = new Date(order.deadline);
      const createdDate = new Date(order.createdAt || order.orderDateTime || Date.now());
      const durationMs = deadlineDate.getTime() - createdDate.getTime();
      const durationStr = this.formatDuration(durationMs);
      const formattedDeadline = format(deadlineDate, 'MMM d, yyyy h:mm a');

      deadlineSection = `⏰ <b>Deadline:</b> <b>${formattedDeadline}</b>\n⏳ <b>Allotted Duration:</b> ${durationStr}\n`;
    }

    const message = [
      `🚗 <b>NEW WORK ORDER CREATED</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📋 <b>Order Number:</b> <code>#${order.orderNumber}</code>`,
      `👤 <b>Customer:</b> ${order.customer?.name || 'N/A'} (📞 ${order.customer?.phone || 'N/A'})`,
      `🚘 <b>Vehicle:</b> <b>${order.vehicle?.plateNumber || 'N/A'}</b> ${order.vehicle?.carModel?.name || order.vehicle?.model?.name ? `(${order.vehicle?.carModel?.name || order.vehicle?.model?.name})` : ''}`,
      order.fsrNumber ? `📄 <b>FSR Number:</b> <code>${order.fsrNumber}</code>` : '',
      deadlineSection.trim(),
      ``,
      `🔧 <b>WORK & SERVICES:</b>`,
      servicesText,
      materialsText ? `\n📦 <b>PARTS & MATERIALS:</b>\n${materialsText}` : '',
      ``,
      `👷 <b>ASSIGNED CREW:</b>`,
      assignmentsText,
      conditionText ? `\n${conditionText.trim()}` : '',
      order.notes ? `📝 <b>Notes:</b> <i>${order.notes}</i>\n` : '',
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `💰 <b>PAYMENT & TOTALS:</b>`,
      Number(order.serviceFee || 0) > 0 ? `• Service Fee: <b>${Number(order.serviceFee).toLocaleString()} ETB</b>` : '',
      `• Total: <b>${total.toLocaleString()} ETB</b>`,
      effectivePaid > 0 ? `• Down Payment: <b>${effectivePaid.toLocaleString()} ETB</b> (Deducted)` : '',
      `• Balance Remaining: <b>${balanceDue.toLocaleString()} ETB</b>`,
      `• Status: <b>${balanceDue === 0 ? 'PAID' : effectivePaid > 0 ? 'PARTIALLY PAID' : 'UNPAID'}</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🕒 <i>Created: ${format(new Date(order.createdAt || Date.now()), 'MMM d, yyyy h:mm a')}</i>`,
    ]
      .filter((line) => line !== '')
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

    const services = (order.serviceLines || [])
      .map((s: any, idx: number) => {
        const cat = s.serviceCategory;
        const name = cat?.service?.nameEn || cat?.nameEn || s.name || `Service #${idx + 1}`;
        return `  ${idx + 1}. ${name}`;
      })
      .join('\n');

    const assignments = (order.assignments || [])
      .map((a: any) => `  • ${a.employee?.name || a.name || 'Technician'} (${a.roleLabel || a.role || 'Staff'})`)
      .join('\n');

    const message = [
      `⚠️ <b>DEADLINE WARNING: ${percentStr}% TIME ELAPSED</b> ⚠️`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🚨 <b>Urgent Attention Required!</b>`,
      `📋 <b>Order:</b> <code>#${order.orderNumber}</code>`,
      `🚘 <b>Vehicle:</b> <b>${order.vehicle?.plateNumber || 'N/A'}</b> ${order.vehicle?.carModel?.name || order.vehicle?.model?.name ? `(${order.vehicle?.carModel?.name || order.vehicle?.model?.name})` : ''}`,
      `👤 <b>Customer:</b> ${order.customer?.name || 'N/A'} (📞 ${order.customer?.phone || 'N/A'})`,
      ``,
      `⏳ <b>TIME PROGRESS:</b>`,
      `• Total Allotted: <b>${totalStr}</b>`,
      `• Elapsed Time: <b>${elapsedStr} (${percentStr}%)</b>`,
      `• <b>TIME REMAINING:</b> 🔴 <b>${remainingStr}</b>`,
      `• Target Deadline: <b>${format(deadlineDate, 'MMM d, yyyy h:mm a')}</b>`,
      ``,
      services ? `🔧 <b>Services In Progress:</b>\n${services}\n` : '',
      assignments ? `👷 <b>Assigned Technicians:</b>\n${assignments}\n` : '',
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `⚡ <i>Please prioritize completion of this order to avoid delivery delay!</i>`,
    ]
      .filter((line) => line !== '')
      .join('\n');

    return this.sendMessage(message);
  }
}
