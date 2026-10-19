import { formatPKR } from '@/lib/format'
import { computeMenuProfitability } from '../metrics'
import type { OperationalContext, AiAnalysisResult } from '../types'

export function analyzeMenuProfitability(context: OperationalContext): AiAnalysisResult {
  const analysis = computeMenuProfitability(
    context.menuItems,
    context.orders,
    context.recipes,
    context.inventory
  )

  const stars = analysis.filter((a) => a.classification === 'Star')
  const plowhorses = analysis.filter((a) => a.classification === 'Plowhorse')
  const puzzles = analysis.filter((a) => a.classification === 'Puzzle')
  const dogs = analysis.filter((a) => a.classification === 'Dog')

  const sortedByMargin = [...analysis].sort((a, b) => b.contributionMargin - a.contributionMargin)
  const topMarginItem = sortedByMargin[0]
  const lowestMarginItem = sortedByMargin[sortedByMargin.length - 1]

  const totalVolume = analysis.reduce((a, b) => a + b.qtySold, 0)
  const sampleCount = totalVolume

  const answer = topMarginItem
    ? `The dish with the highest estimated unit contribution margin is "${topMarginItem.name}" at ${formatPKR(topMarginItem.contributionMargin)} per serving (${topMarginItem.marginPct}% margin on ${formatPKR(topMarginItem.price)} retail price, with estimated ingredient cost of ${formatPKR(topMarginItem.estimatedCost)}). Across the menu, ${stars.length} dishes are classified as Stars (high volume & high margin), ${puzzles.length} as Puzzles (high margin, low volume), and ${plowhorses.length} as Plowhorses (high volume, lower margin).`
    : 'No active dishes found in the menu to analyze contribution margins.'

  return {
    intent: 'menu_profitability',
    title: `Menu Profitability & Contribution Margin (${context.period.label})`,
    summary: topMarginItem
      ? `Top margin dish: ${topMarginItem.name} (${formatPKR(topMarginItem.contributionMargin)} / ${topMarginItem.marginPct}%). Matrix: ${stars.length} Stars, ${puzzles.length} Puzzles, ${plowhorses.length} Plowhorses, ${dogs.length} Dogs.`
      : 'Insufficient dish sales data for margin breakdown.',
    answer,
    metrics: [
      {
        label: 'Top Unit Margin Dish',
        value: topMarginItem ? formatPKR(topMarginItem.contributionMargin) : 'Rs. 0',
        tone: 'ok',
        helper: topMarginItem ? `${topMarginItem.name} (${topMarginItem.marginPct}%)` : undefined,
      },
      {
        label: 'Stars (High Pop & Margin)',
        value: stars.length,
        tone: 'accent',
        helper: stars.map((s) => s.name).slice(0, 2).join(', ') || 'None',
      },
      {
        label: 'Plowhorses (High Pop, Low Margin)',
        value: plowhorses.length,
        tone: 'warn',
        helper: 'High volume, consider recipe portion control',
      },
      {
        label: 'Dogs (Low Pop, Low Margin)',
        value: dogs.length,
        tone: dogs.length > 0 ? 'danger' : 'neutral',
        helper: lowestMarginItem ? `Lowest: ${lowestMarginItem.name} (${lowestMarginItem.marginPct}%)` : 'Review recipe relevance',
      },
    ],
    evidence: sortedByMargin.slice(0, 5).map((item) => ({
      title: `${item.name} (${item.classification})`,
      detail: `Price: ${formatPKR(item.price)} | Est. Ingredient Cost: ${formatPKR(item.estimatedCost)} | Margin: ${formatPKR(item.contributionMargin)} (${item.marginPct}%) | Sold: ${item.qtySold} units`,
      figure: formatPKR(item.contributionMargin),
    })),
    reason: 'Contribution Margin = Selling Price - Estimated Ingredient Recipe Cost. Classification uses Menu Engineering Matrix comparing individual dish sales volume and contribution margin against the menu average.',
    recommendations: [
      {
        actionText: 'Review Menu Pricing & Dish Availability',
        explanation: 'Inspect dish prices, recipes, and availability switches in the Menu management console.',
        targetRoute: '/menu',
        routeLabel: 'Open Menu & Prices',
        priority: 'high',
      },
      {
        actionText: 'Tune Recipe Ingredient Deductions',
        explanation: 'Map raw ingredient quantities to dishes under Inventory & Recipes to improve cost accuracy.',
        targetRoute: '/inventory',
        routeLabel: 'Open Inventory & Recipes',
        priority: 'medium',
      },
    ],
    confidence: sampleCount > 0 ? 'high' : 'medium',
    limitations: [
      'Contribution margin reflects direct raw ingredient costs only; overhead, utility bills, and labor are analyzed separately under Expenses.',
      'Unlinked dishes use benchmark ingredient cost estimates (35% of menu price) until exact recipes are linked.',
    ],
    sourcePeriod: context.period,
    dataQuality: {
      sampleCount,
      reliability: 'complete',
      notes: `${analysis.filter((a) => a.hasRecipe).length} of ${analysis.length} dishes have verified recipe ingredient mappings.`,
    },
    generatedAt: new Date().toISOString(),
  }
}
