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

/* commands */

const commands = [
  new SlashCommandBuilder()
    .setName("ticket-panel")
    .setDescription("Post the Greenland support ticket panel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .toJSON(),

  new SlashCommandBuilder()
    .setName("test-boost")
    .setDescription("Preview the Greenland boost message.")
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

/* boost embed editor */

function buildBoostEmbed(member) {
  return new EmbedBuilder()
    .setColor("#9b59b6")
    .setTitle(
      "<a:boost:1541194194322989157> Greenland has been strengthened! <a:boost:1541194194322989157>",
    )
    .setDescription(
      `Thank you ${member} for boosting **${member.guild.name}**!`,
    )
    .setThumbnail(member.user.displayAvatarURL())
    .setFooter({ text: "Greenland PH • Thank you for your support" })
    .setTimestamp();
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  await registerCommands();
});

client.on(Events.GuildMemberAdd, async (member) => {
  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!channel?.isTextBased()) return;

  /* welcome embed editor here */

  const embed = new EmbedBuilder()
    .setColor("#92c553")
    .setTitle("Welcome to Greenland PH!")
    .setDescription(
      [
        `Hey ${member}, <a:dinosaur:1541189583461421167> welcome to **Greenland PH**! <a:25536clover:1541197359675871242>`,
        "",
        "Here’s where to begin:",
        "",
        "<:205667glowingdotwhite:1539608766243143700> Read the server rules in <#1539389490454601768>",
        "<:205667glowingdotwhite:1539608766243143700> Read Greenland's isle info & rules in <#1539401563502678078>",
        "<:205667glowingdotwhite:1539608766243143700> Need help? Open a ticket in <#1539469830913003540>",
        "",
        "Enjoy your stay! <a:dinosaursjump:1541189521566208070>",
      ].join("\n"),
    )
    .setThumbnail(member.user.displayAvatarURL())
    .setFooter({ text: "Greenland PH • The Isle" })
    .setTimestamp();

  await channel.send({ embeds: [embed] });
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  function buildBoostEmbed(member) {
    return new EmbedBuilder()
      .setColor("#E6A84A")
      .setTitle("✨ A new Greenland boost")
      .setDescription(
        `Thank you ${member} for boosting **${member.guild.name}**!`,
      )
      .setThumbnail(member.user.displayAvatarURL())
      .setFooter({ text: "Greenland PH • Thank you for your support" })
      .setTimestamp();
  }

  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    const justBoosted =
      !oldMember.premiumSinceTimestamp && newMember.premiumSinceTimestamp;

    if (!justBoosted) return;

    const channel = newMember.guild.channels.cache.get(BOOST_CHANNEL_ID);
    if (!channel?.isTextBased()) return;

    await channel.send({
      embeds: [buildBoostEmbed(newMember)],
    });
  });
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === "test-boost"
    ) {
      return interaction.reply({
        embeds: [buildBoostEmbed(interaction.member)],
      });
    }
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
        .setColor("#92c553")
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
            id: interaction.client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.EmbedLinks,
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
