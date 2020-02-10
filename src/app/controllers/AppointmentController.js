import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore, format, subHours } from 'date-fns';
import pt from 'date-fns/locale/pt';
import Appointment from '../models/Appointments';
import User from '../models/Users';
import File from '../models/Files';
import Notification from '../schemas/Notification';
import Queue from '../../lib/Queue';
import CancellationMail from '../jobs/CancellationMail';

class AppointmentController {
  async index(req, res) {
    const { page = 1 } = req.query;
    console.log(req.userId);
    const appoitments = await Appointment.findAll({
      where: { user_id: req.userId, canceled_at: null },
      oder: ['date'],
      attributes: ['id', 'date', 'canceled_at', 'past', 'cancelable'],
      limit: 20,
      offset: (page - 1) * 20,
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name'],
          include: {
            model: File,
            as: 'avatar',
            attributes: ['id', 'path', 'url'],
          },
        },
      ],
    });

    return res.json(appoitments);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      provider_id: Yup.number().required(),
      date: Yup.date().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Validation Fails' });
    }

    const { provider_id, date } = req.body;
    //Check if provider_id is a provider
    const isProvider = await User.findOne({
      where: { id: provider_id, provider: true },
    });

    if (!isProvider || req.userId === provider_id) {
      return res.status(401).json({
        error: 'You can only create appointments with providers',
      });
    }

    // cria um objeto date e pega apenas a hora
    const hourStart = startOfHour(parseISO(date));
    // check date availability
    if (isBefore(hourStart, new Date())) {
      return res.status(400).json({
        error: 'Past date are not permited',
      });
    }

    const checkAvailability = await Appointment.findOne({
      where: {
        provider_id,
        canceled_at: null,
        date: hourStart,
      },
    });

    if (checkAvailability) {
      return res.status(400).json({
        error: 'Appointment hour is not available',
      });
    }

    const appointment = await Appointment.create({
      user_id: req.userId,
      provider_id,
      date: hourStart,
    });

    // Notify provider
    const user = await User.findByPk(req.userId);
    const formatDate = format(
      hourStart,
      "'dia' dd 'de' MMMM ', ' H':'mm 'horas'",
      {
        locale: pt,
      },
    );

    await Notification.create({
      content: `Novo agendamento para ${user.name} no ${formatDate}`,
      user: provider_id,
    });

    return res.json(appointment);
  }

  async delete(req, res) {
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        { model: User, as: 'provider', attributes: ['name', 'email'] },
        {
          model: User,
          as: 'user',
          attributes: ['name'],
        },
      ],
    });

    if (appointment.canceled_at !== null) {
      return res.status(401).json({
        error: 'This appointment was already cancelled',
      });
    }

    if (appointment.user_id !== req.userId) {
      return res.status(401).json({
        error: "You don't have permission to cancel this appointment",
      });
    }

    // diminui duas horas do appointment
    const dateWithSub = subHours(appointment.date, 2);

    // vverifica se a hora de cancelamento eh valida
    if (isBefore(dateWithSub, new Date())) {
      return res.status(401).json({
        error: 'You can only cancel appointment 2 hours in advance',
      });
    }

    appointment.canceled_at = new Date();

    await appointment.save();

    await Queue.add(CancellationMail.key, {
      appointment,
    });

    return res.json(appointment);
  }
}

export default new AppointmentController();
