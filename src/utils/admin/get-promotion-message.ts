import { Authority, User } from "@/lib/models";


export function getPromotionMessage(dj: User, authority: Authority): string {
    let message = "Are you sure you want to";

    if (authority >= dj.authority) {
      message += " promote ";
    }
    else {
      message += " demote ";
    }

    message += `${(dj.name?.length ?? 0 > 0 ? dj.name : null) ?? dj.username ?? "this account"} to a `;

    switch (authority) {
      case Authority.DJ:
        message += "DJ?";
        break;
      case Authority.MD:
        message += "Music Director?";
        break;
      case Authority.SM:
        message += "Station Manager?";
        break;
    }

    return message;
}