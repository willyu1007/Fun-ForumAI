import { StyleSheet } from 'react-native'
import { colors, fontSize, radius, spacing } from '../theme'

export const shared = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: spacing.md,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
  },
  sectionTitle: {
    marginTop: spacing.sm,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.primaryText,
    fontWeight: '600',
    fontSize: fontSize.sm,
  },
  secondaryButton: {
    backgroundColor: colors.secondaryBg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  listRow: {
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: spacing.sm,
  },
  listRowSelected: {
    borderColor: colors.selectedBorder,
    backgroundColor: colors.selectedBg,
  },
  itemText: {
    color: colors.text,
    fontSize: fontSize.sm,
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  detailBox: {
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.sm,
    padding: 10,
    gap: spacing.sm,
  },
  messageRow: {
    marginTop: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingBottom: 6,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  disabled: {
    opacity: colors.disabled,
  },
})
