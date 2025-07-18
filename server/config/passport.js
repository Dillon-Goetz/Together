const DiscordStrategy = require("passport-discord").Strategy;
const User = require("../models/User");

module.exports = function (passport) {
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => done(err, user));
  });

  // Conditionally require & execute the mocking module as `nock` is not installed in production
  if (process.env.NODE_ENV === "test")
    require("../test/passport-discord-mocking")();

  //Discord authentication
  passport.use(
    new DiscordStrategy(
      {
        //Get client ID and Secret from discord developer portal
        clientID: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        callbackURL: "api/auth/discord/callback",
        // pulls discord username without email, and returns basic information about all the user's current guilds / servers.
        scope: ["identify", "guilds"],
        passReqToCallback: true,
      },
      async function (currentReq, accessToken, refreshToken, profile, cb) {
        const displayName =
          profile.discriminator.length === 4
            ? `${profile.username}#${profile.discriminator}`
            : profile.username;
        const is100Dever = profile.guilds.some(
          (server) => server.id === "735923219315425401"
        );

        if (!is100Dever) {
          currentReq.session.isNot100Dever = true;
          return cb(null, false);
        }
        // Check if user exists in DB
        let user = await User.findOne({ discordId: profile.id }).exec();

        try {
          // Create user if it doesn't exist
          if (!user) {
            user = await User.create({
              displayName: displayName,
              discordId: profile.id,
              avatar: profile.avatar,
              socials: [],
              bio: "",
              needsToBeWelcome: true,
            });

            return cb(null, user);
          } else {
            // it user already exists, update display name and avatar
            user.displayName = displayName;
            user.avatar = profile.avatar;
            const updatedUser = await user.save();

            return cb(null, updatedUser);
          }
        } catch (err) {
          // do something with error
          console.log(err);
          return cb(err, false);
        }
      }
    )
  );
};
