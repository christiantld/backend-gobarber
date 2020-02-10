import { format, parseISO } from 'date-fns';
import pt from 'date-fns/locale/pt';
import Mail from '../../lib/Mail';

class CancellationMail {
  get key() {
    return 'CancellationMail';
  }

  //Chamado para o envio de cada email
  async handle({ data }) {
    const { appointment } = data;

    console.log('A fila executou');
    console.log(format(new Date(), "'dia' dd 'de' MMMM ', ' H':'mm 'horas'"));

    await Mail.sendMail({
      to: `${appointment.provider.name} <${appointment.provider.email}>`,
      subject: 'Agendamento Cancelado',
      template: 'cancellation',
      context: {
        provider: appointment.provider.name,
        user: appointment.user.name,
        date: format(
          parseISO(appointment.date),
          "'dia' dd 'de' MMMM ', ' H':'mm 'horas'",
          {
            locale: pt,
          },
        ),
      },
    });
  }
}

export default new CancellationMail();
