require("dotenv").config();

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  ModalBuilder,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const {
  DISCORD_TOKEN,
  CLIENT_ID,
  GUILD_ID,
  WELCOME_CHANNEL_ID,
  BOOST_CHANNEL_ID,
  TICKET_CATEGORY_ID,
  SUPPORT_ROLE_ID,
} = process.env;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

const commands = [
  new SlashCommandBuilder()
    .setName("ticket-panel")
    .setDescription("Post the Greenland support ticket panel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .toJSON(),
];

function isSupport(member) {
  return (
    member.permissions.has(PermissionFlagsBits.ManageChannels) ||
    member.roles.cache.has(SUPPORT_ROLE_ID)
  );
}

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commands,
  });

  console.log("Slash commands registered.");
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  await registerCommands();
});

client.on(Events.GuildMemberAdd, async (member) => {
  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(0x7ebc4c)
    .setTitle("Welcome to Greenland PH")
    .setDescription(
      `Welcome ${member} to **Greenland PH**.\nPlease read the rules and enjoy your stay.`,
    )
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp();

  await channel.send({ embeds: [embed] });
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  const justBoosted =
    !oldMember.premiumSinceTimestamp && newMember.premiumSinceTimestamp;

  if (!justBoosted) return;

  const channel = newMember.guild.channels.cache.get(BOOST_CHANNEL_ID);
  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(0xe6a84a)
    .setTitle("New server boost")
    .setDescription(
      `Thank you ${newMember} for boosting **${newMember.guild.name}**! ✨`,
    )
    .setThumbnail(newMember.user.displayAvatarURL())
    .setTimestamp();

  await channel.send({ embeds: [embed] });
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === "ticket-panel"
    ) {
      const button = new ButtonBuilder()
        .setCustomId("ticket-open")
        .setLabel("Open a ticket")
        .setEmoji("🎫")
        .setStyle(ButtonStyle.Success);

      const embed = new EmbedBuilder()
        .setColor(0x7ebc4c)
        .setTitle("Greenland PH Support")
        .setDescription(
          "Need help? Press the button below to open a private support ticket.",
        )
        .setFooter({ text: "One ticket per issue." });

      await interaction.channel.send({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(button)],
      });

      return interaction.reply({
        content: "Ticket panel posted.",
        ephemeral: true,
      });
    }

    if (interaction.isButton() && interaction.customId === "ticket-open") {
      const modal = new ModalBuilder()
        .setCustomId("ticket-modal")
        .setTitle("Open a support ticket");

      const subject = new TextInputBuilder()
        .setCustomId("subject")
        .setLabel("What do you need help with?")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(80);

      const details = new TextInputBuilder()
        .setCustomId("details")
        .setLabel("Describe your issue")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

      modal.addComponents(
        new ActionRowBuilder().addComponents(subject),
        new ActionRowBuilder().addComponents(details),
      );

      return interaction.showModal(modal);
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId === "ticket-modal"
    ) {
      const existingTicket = interaction.guild.channels.cache.find(
        (channel) => channel.topic === `ticket-owner:${interaction.user.id}`,
      );

      if (existingTicket) {
        return interaction.reply({
          content: `You already have an open ticket: ${existingTicket}`,
          ephemeral: true,
        });
      }

      const subject = interaction.fields.getTextInputValue("subject");
      const details = interaction.fields.getTextInputValue("details");

      const ticketChannel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-"),
        type: ChannelType.GuildText,
        parent: TICKET_CATEGORY_ID,
        topic: `ticket-owner:${interaction.user.id}`,
        permissionOverwrites: [
          {
            id: interaction.guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
          {
            id: SUPPORT_ROLE_ID,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
        ],
      });

      const closeButton = new ButtonBuilder()
        .setCustomId("ticket-close")
        .setLabel("Close ticket")
        .setEmoji("🔒")
        .setStyle(ButtonStyle.Danger);

      const embed = new EmbedBuilder()
        .setColor(0x7ebc4c)
        .setTitle("Support ticket")
        .addFields(
          { name: "Member", value: `${interaction.user}`, inline: true },
          { name: "Subject", value: subject },
          { name: "Details", value: details },
        )
        .setTimestamp();

      await ticketChannel.send({
        content: `${interaction.user}`,
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(closeButton)],
      });

      return interaction.reply({
        content: `Your ticket is ready: ${ticketChannel}`,
        ephemeral: true,
      });
    }

    if (interaction.isButton() && interaction.customId === "ticket-close") {
      const ownerId = interaction.channel.topic?.replace("ticket-owner:", "");
      const isOwner = ownerId === interaction.user.id;

      if (!isOwner && !isSupport(interaction.member)) {
        return interaction.reply({
          content: "Only the ticket owner or staff can close this ticket.",
          ephemeral: true,
        });
      }

      await interaction.reply("Closing this ticket in 5 seconds.");

      setTimeout(() => {
        interaction.channel.delete("Ticket closed");
      }, 5000);
    }
  } catch (error) {
    console.error(error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "Something went wrong. Please try again.",
        ephemeral: true,
      });
    }
  }
});

client.login(DISCORD_TOKEN);
