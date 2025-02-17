import {
  Box,
  ColorPaletteProp,
  Sheet,
  Stack,
  Typography,
  VariantProp,
} from "@mui/joy";

export default function MessageEntry({
  startDecorator,
  children,
  endDecorator,
  color,
  variant,
}: {
  startDecorator?: React.ReactNode;
  children: React.ReactNode;
  endDecorator?: React.ReactNode;
  color: ColorPaletteProp;
  variant: VariantProp;
}) {
  return (
    <Sheet
      color={color}
      variant={variant}
      sx={{
        height: "40px",
        borderRadius: "md",
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1}
        sx={{
          height: "100%",
          p: 1,
        }}
      >
        <Typography textColor="text.tertiary">{startDecorator}</Typography>
        {children}
        <Box>
          <Typography level="body-xs">{endDecorator}</Typography>
        </Box>
      </Stack>
    </Sheet>
  );
}
