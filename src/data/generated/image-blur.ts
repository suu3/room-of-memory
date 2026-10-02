// 생성물: 직접 고치지 말 것. `pnpm images:blur` (scripts/build-image-blur.mjs)

/** 그림 경로(`?v=` 없이) → 흐린 미리보기 data URL. */
export const IMAGE_BLUR: Readonly<Record<string, string>> = {
  "/assets/images/cutscene-day-1.webp":
    "data:image/webp;base64,UklGRmgAAABXRUJQVlA4IFwAAADwAQCdASoQAAkAAsBMJQBOj+ACAY+hVAAA/vlROya87jdCSJkPUSq8cWQz6zIWU/w/xkB+owBKdig3CA2c+tGX2BLlAqPrmucHnECc5/5vk7ZUMdylv5r9vJgAAA==",
  "/assets/images/cutscene-day-2.webp":
    "data:image/webp;base64,UklGRmQAAABXRUJQVlA4IFgAAACwAQCdASoQAAkAAsBMJQBOgBm+gXaAAP70t5z9Y3V9CQ3ddHLp+m56LYwbHfenuNXusx1s4gDjNg2N/0S+vS85Tg3D+WxPqa6JGRRmg0h0M+ytLKTXvyAA",
  "/assets/images/cutscene-day-3.webp":
    "data:image/webp;base64,UklGRmAAAABXRUJQVlA4IFQAAAAwAgCdASoQAAkAAsBMJYgCdAYulvMTA3QMIAD+vH39zw7ld/EIA3Y58MJFuNv69H/xPcTG+SR3YL4hn7r/yroNa0HGGxGHsVRMM4omJVU7sFywAAA=",
  "/assets/images/cutscene-day-4.webp":
    "data:image/webp;base64,UklGRmIAAABXRUJQVlA4IFYAAADwAQCdASoQAAkAAsBMJYgCdADdLDjtTAAA/s70z599K3amu63lqncBui/ynBRajfLwclpxmPVx8+/sL7/WGxGshhMR2qOwGEQN4Fy41Ux4qBJvEIAAAA==",
  "/assets/images/cutscene-day-5.webp":
    "data:image/webp;base64,UklGRmgAAABXRUJQVlA4IFwAAADwAQCdASoQAAkAAsBMJQBOgB061WNbwPwA/vRxjkcr/pC+BI/7+xEK1zSkiswfPHnic6AdbJu21zuIV4RvsDzJbosfr4ZH77c8pXCNMs5EZXES2ThmNPHNKlRwAA==",
  "/assets/images/cutscene-day-6.webp":
    "data:image/webp;base64,UklGRmAAAABXRUJQVlA4IFQAAAAwAgCdASoQAAkAAsBMJYwC7AELz8weJGLhgAD++xgp5lhvcz4+lF3PBxYBih6a0PEH8TRgT9yS/T6gpJ7fndPYxlLYLNQS730bXkRksPg5dMCbAAA=",
  "/assets/images/cutscene-day-7.webp":
    "data:image/webp;base64,UklGRnAAAABXRUJQVlA4IGQAAAAwAgCdASoQAAkAAsBMJbACdAYtpt9UohzuIAD+9u3qxxWRrhMgLn0eWjseBzV6gdj2xVw4oy/JKT+QDbAQd8nt5O9n4FJejCOx5PxUgOSLaC+SS24bSuh9rdmUgPqLhuwQCAAA",
  "/assets/images/cutscene-survivor-1.webp":
    "data:image/webp;base64,UklGRmQAAABXRUJQVlA4IFgAAADwAQCdASoQAAkAAsBMJZQCdADJyjqbywAA/upSsZCImpxc5uAkZxTF+3LfBOBtFloNGs75TkwDyfJhk9bN0ERNpJfTMf+HGexk/h5sQWefm0hko9DK+AAA",
  "/assets/images/cutscene-survivor-10.webp":
    "data:image/webp;base64,UklGRl4AAABXRUJQVlA4IFIAAAAQAgCdASoMABAAAsBMJQBdgCHhoO12TCGAAP70QckZytGIToNY7WgG98sJ/ihuLNRxVgFN4Nl+FMzy2NyjFvo45818/QF2Dl043PUVJOJApgAA",
  "/assets/images/cutscene-survivor-2.webp":
    "data:image/webp;base64,UklGRmYAAABXRUJQVlA4IFoAAAAQAgCdASoMABAAAsBMJQBOgCFrtX9wp0oAAP74TpXDVnkSD+9MwnghYTJqIpiX4kC/zILW26E4F03GURDcYkxOUfvWS0K1fMS1AxW1GibHkwiCxBN+aSQAAAA=",
  "/assets/images/cutscene-survivor-3.webp":
    "data:image/webp;base64,UklGRmwAAABXRUJQVlA4IGAAAAAwAgCdASoMABAAAsBMJYwC7AEVvL52JDpKYAD++KdxHfKyMoSvhcCQs3DF3eYy5XfWKjifInw9lw9Md9C/cJMuuG9PKtIoC+qNlp/e499+AZ6JVn2zxM6NgWC9Se/7OAA=",
  "/assets/images/cutscene-survivor-4.webp":
    "data:image/webp;base64,UklGRlwAAABXRUJQVlA4IFAAAADwAQCdASoQAAkAAsBMJZQCdAEORd7RaYAA/vbegxZvWXZQFTDuJ7U9+BsyLR+36vzot8gnjQ+IgLdjjPtvsBx/2zb6chimR2Y7+SJcGjBQAA==",
  "/assets/images/cutscene-survivor-5.webp":
    "data:image/webp;base64,UklGRlQAAABXRUJQVlA4IEgAAADQAQCdASoMABAAAsBMJQBdgCHfRJ8yAAD++nKd+4/MmDkjiVI9ZfBZ9yV/H6i594tODsoEBfl2M6gD9Rdbw/8n4nkZ7GTagAA=",
  "/assets/images/cutscene-survivor-6.webp":
    "data:image/webp;base64,UklGRoIAAABXRUJQVlA4IHYAAAAQAgCdASoMABAAAsBMJQBWACPPXx+mxfIAAP7qXyS8stFGMtmCa38zZwN2t+bflj5+2VNr3LWFa68cp8Uva23xI+Qv+tyV1YhumW9RBe3I9zvaZw7xjMzevcbzgGXENjE6gkxOYXdYKhQAhqZVyriybg1miAAA",
  "/assets/images/cutscene-survivor-7.webp":
    "data:image/webp;base64,UklGRmAAAABXRUJQVlA4IFQAAAAQAgCdASoQAAkAAsBMJaACsAEQN5G1OroAAP74gJjt9MfvfWcIP04tPva7CoV1zKcP8t0EP1vi0QxA4CPl7QFvt70cSVATkdY34JkTrIj7ZE+AAAA=",
  "/assets/images/cutscene-survivor-8.webp":
    "data:image/webp;base64,UklGRlQAAABXRUJQVlA4IEgAAADwAQCdASoQAAkAAsBMJZwAAscBI6T8bZgA/vfICZWsJ+2HbvbKPwn9ln6UxE9uyvZS/OLLSxn5QEHhR3CIRJfO3vYYKIFYAAA=",
  "/assets/images/cutscene-survivor-9.webp":
    "data:image/webp;base64,UklGRlYAAABXRUJQVlA4IEoAAADwAQCdASoMABAAAsBMJQBOgCKUl19kMwAA/vfLw2ftj14LjUbGX3+D0+x+bjEzhnAJyqbaTorDrTzbDLE7GiatypEs8F5XP36wAA==",
  "/assets/images/mg-ball-catch-sunset-field.webp":
    "data:image/webp;base64,UklGRlwAAABXRUJQVlA4IFAAAAAQAgCdASoQAAkAAsBMJagCdEf/gbfmBOTwAPKls0gT2yU0kL/HRMWse8BpEGeqFbFTuWY66mZFn7NO57eqMLQMwWtgXDQPqkXYVZ33zAAAAA==",
  "/assets/images/mg-calendar-flip-07.webp":
    "data:image/webp;base64,UklGRiwAAABXRUJQVlA4ICAAAAAwAQCdASoLABAAAsBMJZwAA3AA/vaMafQm8PNEIZwIAA==",
  "/assets/images/mg-calendar-flip-08.webp":
    "data:image/webp;base64,UklGRjAAAABXRUJQVlA4ICQAAAAwAQCdASoLABAAAsBMJZwAA3AA/vaMafdWB76NEb5yzOBAAAA=",
  "/assets/images/mg-calendar-flip-09.webp":
    "data:image/webp;base64,UklGRjIAAABXRUJQVlA4ICYAAACQAQCdASoLABAAAsBMJZwAAtz1DgAA/vmT69M5aYr8PBzazgQAAA==",
  "/assets/images/mg-calendar-flip-10.webp":
    "data:image/webp;base64,UklGRjIAAABXRUJQVlA4ICYAAACwAQCdASoLABAAAsBMJZwAAt0IubAAAP75dSytSLMJ2AKs7OBAAA==",
  "/assets/images/mg-calendar-flip-11.webp":
    "data:image/webp;base64,UklGRjgAAABXRUJQVlA4ICwAAACwAQCdASoLABAAAsBMJZwAAt0Ig/gAAP75ksVk4M33XyZx5fbu1Db5uZAAAA==",
  "/assets/images/mg-cutscene-ball-flashback.webp":
    "data:image/webp;base64,UklGRmIAAABXRUJQVlA4IFYAAAAQAgCdASoQAAkAAsBMJYgCdEf/gUOTeggAAP6YP9walebpFBKVwJ6kuVwSQmjlcEMyK09u+LkpyWg0E6XuU8+eNxus6YyTWEzQZrvz2bKBQU9KGIAAAA==",
  "/assets/images/mg-cutscene-console-flashback.webp":
    "data:image/webp;base64,UklGRlQAAABXRUJQVlA4IEgAAACQAQCdASoQAAkAAsBMJYwCdABV8gAA8o63HawePszT03wLMPotS4dchJ6Nl0m8Raz3I2ywWmzvjQJAY5Jibm9+iDOdrJ5zAAA=",
  "/assets/images/mg-photo-wipe-phase-1.webp":
    "data:image/webp;base64,UklGRmwAAABXRUJQVlA4IGAAAAAQAgCdASoQAA8AAsBMJZQCdAEfnQvVlLeIAPw64ZcBFAH0dLdVPir7D2ezy5QkKWprRAlash4RBmAOtllRQl19QmYI8kDCR+HmbEAH+jLQQLXR/YmLuhbSLuWfMSMwAAA=",
  "/assets/images/mg-photo-wipe-phase-2.webp":
    "data:image/webp;base64,UklGRnYAAABXRUJQVlA4IGoAAABQAgCdASoQAA0AAsBMJZQCdAYv/v1oVXMyaUAA/vCvTP7Up0QZFSzRPmmGpDkfOpemUKxyvlBtnbMxwgqE5J9bwBoU+zt2ju0UB61YF6Iiv9WFtqFCy5Iq5uqm8mh7dd3JK1g6vdKjQAAA",
  "/assets/images/mg-window-view-outside.webp":
    "data:image/webp;base64,UklGRmQAAABXRUJQVlA4IFgAAADwAQCdASoQAAwAAsBMJYwCdAEN3TNJwAAA/cefZT24KgmisaWhLKnDtTbHJb7cJ5tiPITjBBihr5ts1vDc3BG9D11NpOo3BWdp/ud9nHQvNiLn/aTlAAAA",
  "/assets/images/still-ampoule.webp":
    "data:image/webp;base64,UklGRjwAAABXRUJQVlA4IDAAAADwAQCdASoQAAwAAsBMJZwAAqH0x0F+pgAA/uv76+p9wdmR1UAtQ6PUphmPChxYEAA=",
  "/assets/images/still-computer.webp":
    "data:image/webp;base64,UklGRlwAAABXRUJQVlA4IFAAAAAQAgCdASoQAAwAAsBMJQBOgB8oCv9F6rx4AP7c+weYEJpwJzOjJao7kH0R9CFyG8DnjuIt0bmoOZesF+6qfrx+8ShjxTleWWTsotH0esbAAA==",
  "/assets/images/still-duffel.webp":
    "data:image/webp;base64,UklGRlQAAABXRUJQVlA4IEgAAACQAQCdASoQAAwAAsBMJZwAAVQeQAAA/vDfE75Xns2P7K7yxSaGdLo0Yl/OkfHGog4GY6XEoe4n7EONMRXJ/sQQQ3M+pl8AAAA=",
  "/assets/images/still-fridge.webp":
    "data:image/webp;base64,UklGRjIAAABXRUJQVlA4ICYAAADQAQCdASoQAAwAAsBMJaQAAudVnl2eAAD+6MVGJ+xJbsrUEbAAAA==",
  "/assets/images/still-phone.webp":
    "data:image/webp;base64,UklGRkIAAABXRUJQVlA4IDYAAADwAQCdASoQAAwAAsBMJZACdAEKz3x+EAAA/qvZU8z63l5U4a8KvnMTpEG4DLppfG2Dwwc0AAA=",
  "/assets/images/still-report-card.webp":
    "data:image/webp;base64,UklGRloAAABXRUJQVlA4IE4AAAAQAgCdASoQAAwAAsBMJYwCdADxLn+yG6AAAP7vYylw1jzbw/JEdqz7SILnbWoJ+G/nK5GBR8/Ni5thIblNo894G9qwzAVuEOYog84AAAA=",
  "/assets/images/still-shoes.webp":
    "data:image/webp;base64,UklGRjwAAABXRUJQVlA4IDAAAACQAQCdASoQAAwAAsBMJZwAAp1BVwAA/u9TLIV/fy9Az9cOmPd99m8byRJCz6lgQAA=",
  "/assets/images/ui-ending-thanks.webp":
    "data:image/webp;base64,UklGRlwAAABXRUJQVlA4IFAAAADwAQCdASoMABAAAsBMJaQAD5MvsleeYbAA/vqs+W0WGP3EKyBk0RPxHPHDB1Y8cQJub/AXFvIC+1D1L43aEQoeiDkP34K1Y1QjZPjRq1wAAA==",
};

/** 구울 때 본 원본의 해시 (알파라 건너뛴 것까지). 그림이 바뀌었는데 다시 굽지 않았으면 테스트가 잡는다. */
export const IMAGE_BLUR_SOURCES: Readonly<Record<string, string>> = {
  "/assets/images/cutscene-day-1.webp": "9f3ea9a570130637",
  "/assets/images/cutscene-day-2.webp": "792c5ad8798eb092",
  "/assets/images/cutscene-day-3.webp": "f4f4d183c8afa5c0",
  "/assets/images/cutscene-day-4.webp": "4fa42bbdd6cbd456",
  "/assets/images/cutscene-day-5.webp": "072c54cdd0ee8378",
  "/assets/images/cutscene-day-6.webp": "335b38a5faeee1f0",
  "/assets/images/cutscene-day-7.webp": "1dcb5617c25624e4",
  "/assets/images/cutscene-survivor-1.webp": "91fbae0c4d137930",
  "/assets/images/cutscene-survivor-10.webp": "e67043da3bee8d54",
  "/assets/images/cutscene-survivor-2.webp": "e63ac6502eba03ff",
  "/assets/images/cutscene-survivor-3.webp": "06c5377f035c05a3",
  "/assets/images/cutscene-survivor-4.webp": "85bd4931e6c01bab",
  "/assets/images/cutscene-survivor-5.webp": "0da865ff809e5652",
  "/assets/images/cutscene-survivor-6.webp": "eb628d7a847c2c35",
  "/assets/images/cutscene-survivor-7.webp": "3cdee308333f6461",
  "/assets/images/cutscene-survivor-8.webp": "0af69763c273e809",
  "/assets/images/cutscene-survivor-9.webp": "547178e36d01ecb2",
  "/assets/images/mg-ball-catch-sunset-field.webp": "497d229997c49505",
  "/assets/images/mg-calendar-flip-07.webp": "571d51b0d28e7e07",
  "/assets/images/mg-calendar-flip-08.webp": "d5ab6f805516a67a",
  "/assets/images/mg-calendar-flip-09.webp": "7fa83cd5525e66fd",
  "/assets/images/mg-calendar-flip-10.webp": "258ca17364849922",
  "/assets/images/mg-calendar-flip-11.webp": "c404acfe3f0fd04d",
  "/assets/images/mg-cutscene-ball-flashback.webp": "bb0af05752823bab",
  "/assets/images/mg-cutscene-console-flashback.webp": "8582bfafea61d0fd",
  "/assets/images/mg-photo-wipe-phase-1.webp": "a5acd491e3187079",
  "/assets/images/mg-photo-wipe-phase-2.webp": "75f444cc26a7337a",
  "/assets/images/mg-window-view-outside.webp": "bda481270abe7e5e",
  "/assets/images/still-ampoule.webp": "e2cc1c53bf533d1b",
  "/assets/images/still-computer.webp": "e2df1d675e7e9446",
  "/assets/images/still-duffel.webp": "b6d4ff5448e91bbf",
  "/assets/images/still-fridge.webp": "84bd4db1513559ab",
  "/assets/images/still-phone.webp": "3470352ece4151b5",
  "/assets/images/still-report-card.webp": "ecc45e7ad3ebd770",
  "/assets/images/still-shoes.webp": "4b91396506966f62",
  "/assets/images/ui-ending-thanks.webp": "65314fe34dd80fc7",
};
