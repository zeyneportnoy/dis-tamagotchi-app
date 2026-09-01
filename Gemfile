# Pins the CocoaPods toolchain so `pod install` is reproducible for every
# developer and CI instead of depending on whatever `gem install cocoapods` left
# on the machine. Expo CLI (`expo prebuild` / `expo run:ios`) and the
# `postinstall` hook both call `bundle exec pod install` when this file exists.
#
#   bundle install            # once
#   bundle exec pod install   # from ios/ (usually run for you)
#
# ── Toolchain note ─────────────────────────────────────────────────────────────
# The active Ruby is the macOS system Ruby (2.6.10). That caps CocoaPods at the
# 1.15.x line (1.16+ needs Ruby >= 2.7) and, because Ruby 2.6 lacks
# `Enumerable#filter_map`, Expo SDK 57's precompiled-module resolver falls back to
# building every Expo module from source (the "[Expo-precompiled] Failed to read
# spm.config.json … undefined method `filter_map`" warnings during pod install).
# That fallback is harmless — it is how this project has always built — but the
# proper long-term fix is Ruby 3.3+ with CocoaPods >= 1.16.2:
#
#   brew install cocoapods        # pulls a modern Ruby too
#   bundle update cocoapods       # then bump the pin below
#
# Once on Ruby >= 2.7 the `filter_map` warnings disappear and precompiled
# xcframeworks are used, so ExpoSQLite is no longer recompiled from Swift at all.

source 'https://rubygems.org'

# CocoaPods 1.15 loads ActiveSupport 6.1.x, which references `Logger` without
# `require 'logger'`. concurrent-ruby >= 1.3.5 dropped the transitive require
# that used to hide this, so `pod` crashes on boot with
# "uninitialized constant ActiveSupport::LoggerThreadSafeLevel::Logger".
# The Gemfile is loaded in-process before the `pod` binstub, so requiring logger
# here defines the constant in time. Self-noop once Ruby ships it eagerly again.
require 'logger'

# 1.16+ requires Ruby >= 2.7 (see note above). Matches the version the committed
# app was last integrated with.
gem 'cocoapods', '~> 1.15.2'
gem 'activesupport', '>= 6.1.7.5', '!= 7.1.0'
gem 'logger'
